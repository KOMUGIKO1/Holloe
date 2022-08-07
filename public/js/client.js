"use strict";

// ↓↓↓グローバル変数↓↓↓

const g_elementDivJoinScreen = document.getElementById( "joinScreen" );
const g_elementDivChatScreen = document.getElementById( "talkScreen" );

const g_elementMenuBar = document.getElementById( "menuBar" );
const g_elementCheckboxCamera = document.getElementById( "camBtn" );
const g_elementCheckboxMicrophone = document.getElementById( "micBtn" );

const g_elementVideolocal = document.getElementById( "localVideo" );
const g_elementVideoRemote = document.getElementById( "video_remote" );
const g_elementAudioRemote = document.getElementById( "audio_remote" );

let g_rtcPeerConnection = null;

// クライアントからサーバーへの接続要求
const g_socket = io.connect();


// ↓↓↓UIから呼ばれる関数↓↓↓

// Joinボタン押下
function onJoinBtnClicked()
{
    g_elementDivJoinScreen.style.display = "none";
    g_elementDivChatScreen.style.display = "block";
}
// カメラ / マイクボタン押下
function onCamMicBtnClicked()
{
    // これまでの状態
    let trackCamera_old = null;
    let trackMicrophone_old = null;
    let bCamera_old = false;
    let bMicrophone_old = false;
    let stream = g_elementVideolocal.srcObject;
    if( stream )
    {
        trackCamera_old = stream.getVideoTracks()[0];
        if( trackCamera_old )
        {
            bCamera_old = true;
        }
        trackMicrophone_old = stream.getAudioTracks()[0];
        if( trackMicrophone_old )
        {
            bMicrophone_old = true;
        }
    }

    // 今後の状態
    let bCamera_new = false;
    if( g_elementCheckboxCamera.checked )
    {
        bCamera_new = true;
    }
    let bMicrophone_new = false;
    if( g_elementCheckboxMicrophone.checked )
    {
        bMicrophone_new = true;
    }

    // 状態変化
    console.log( "Camera :  %s => %s", bCamera_old, bCamera_new );
    console.log( "Microphoneo : %s = %s", bMicrophone_old, bMicrophone_new );

    if( bCamera_old === bCamera_new && bMicrophone_old === bMicrophone_new )
    {   // チェックボックスの状態の変化なし
        return;
    }

    // 古いメディアストリームのトラックの停止（トラックの停止をせず、HTML要素のstreamの解除だけではカメラは停止しない（カメラ動作LEDは点いたまま））
    if( trackCamera_old )
    {
        console.log( "Call : trackCamera_old.stop()" );
        trackCamera_old.stop();
    }
    if( trackMicrophone_old )
    {
        console.log( "Call : trackMicrophone_old.stop()" );
        trackMicrophone_old.stop();
    }
    // HTML要素のメディアストリームの解除
    console.log( "Call : setStreamToElement( Video_Local, null )" );
    setStreamToElement( g_elementVideolocal, null );

    if( !bCamera_new && !bMicrophone_new )
    {   // （チェックボックスの状態の変化があり、かつ、）カメラとマイクを両方Offの場合
        return;
    }

    // （チェックボックスの状態の変化があり、かつ、）カメラとマイクのどちらかもしくはどちらもOnの場合

    // 自分のメディアストリームを取得する。
    console.log( "Call : navigator.mediaDevices.getUserMedia( video=%s, audio=%s )", bCamera_new, bMicrophone_new );
    navigator.mediaDevices.getUserMedia( { video: bCamera_new, audio: bMicrophone_new } )
        .then( ( stream ) =>
        {
            // HTML要素へのメディアストリームの設定
            console.log( "Call : setStreamToElement( Video_Local, stream )" );
            setStreamToElement( g_elementVideolocal, stream );
        } )
        .catch( ( error ) =>
        {
            // メディアストリームの取得に失敗⇒古いメディアストリームのまま。チェックボックスの状態を戻す。
            console.error( "Error : ", error );
            alert( "Could not start Camera." );
            g_elementCheckboxCamera.checked = false;
            g_elementCheckboxMicrophone.checked = false;
            return;
        } );
}

// Offerボタン押下
function onOfferBtnClicked()
{
    if( g_rtcPeerConnection )
    {   // 既にコネクションオブジェクトあり
        alert( "Connection object already exists." );
        return;
    }

    // RTCPeerConnectionオブジェクトの作成
    console.log( "Call : createPeerConnection()" );
    let rtcPeerConnection = createPeerConnection( g_elementVideolocal.srcObject );
    g_rtcPeerConnection = rtcPeerConnection;    // グローバル変数に設定

    // OfferSDPの作成
    createOfferSDP( rtcPeerConnection );
}

// Quitボタン押下
function onQuitBtnClicked()
{
    if( g_rtcPeerConnection )
    {
        console.log( "Call : endPeerConnection()" );
        endPeerConnection( g_rtcPeerConnection );
    }
}

// Closeボタン押下
// function onCloseBtnClicked()
// {
//     if ( g_elementMenuBar.style.display == "none" )
//     {
//         g_elementMenuBar.style.display = "block";
//     }
//     else
//     {
//         g_elementMenuBar.style.display = "none";
//     }
// }


// ↓↓↓Socket.IO関連の関数↓↓↓

// 接続時の処理
// ・サーバーとクライアントの接続が確立すると、
// 　サーバー側で、"connection"イベント
// 　クライアント側で、"connect"イベントが発生する
g_socket.on(
    "connect",
    () =>
    {
        console.log( "Socket Event : connect" );
    } );

// サーバーからのメッセージ受信に対する処理
// ・サーバー側のメッセージ拡散時の「io.broadcast.emit( "signaling", objData );」に対する処理
g_socket.on(
    "signaling",
    ( objData ) =>
    {
        console.log( "Socket Event : signaling" );
        console.log( "- type : ", objData.type );
        console.log( "- data : ", objData.data );

        if( "offer" === objData.type )
        {
            // onclickButton_SetOfferSDPandCreateAnswerSDP()と同様の処理
            // 設定するOffserSDPとして、テキストエリアのデータではなく、受信したデータを使用する。

            if( g_rtcPeerConnection )
            {   // 既にコネクションオブジェクトあり
                alert( "Connection object already exists." );
                return;
            }

            // RTCPeerConnectionオブジェクトの作成
            console.log( "Call : createPeerConnection()" );
            let rtcPeerConnection = createPeerConnection( g_elementVideolocal.srcObject );
            g_rtcPeerConnection = rtcPeerConnection;    // グローバル変数に設定

            // OfferSDPの設定とAnswerSDPの作成
            console.log( "Call : setOfferSDP_and_createAnswerSDP()" );
            setOfferSDP_and_createAnswerSDP( rtcPeerConnection, objData.data );   // 受信したSDPオブジェクトを渡す。
        }
        else if( "answer" === objData.type )
        {
            // onclickButton_SetAnswerSDPthenChatStarts()と同様の処理
            // 設定するAnswerSDPとして、テキストエリアのデータではなく、受信したデータを使用する。

            if( !g_rtcPeerConnection )
            {   // コネクションオブジェクトがない
                alert( "Connection object does not exist." );
                return;
            }

            // AnswerSDPの設定
            console.log( "Call : setAnswerSDP()" );
            setAnswerSDP( g_rtcPeerConnection, objData.data );   // 受信したSDPオブジェクトを渡す。
        }
        else
        {
            console.error( "Unexpected : Socket Event : signaling" );
        }
    } );

// ↓↓↓DataChannel関連の関数↓↓↓

// ↓↓↓RTCPeerConnection関連の関数↓↓↓

// RTCPeerConnectionオブジェクトの作成
function createPeerConnection( stream )
{
    // RTCPeerConnectionオブジェクトの生成
    let config = {
        "iceServers": [
            { "urls": "stun:stun.l.google.com:19302" },
            { "urls": "stun:stun1.l.google.com:19302" },
            { "urls": "stun:stun2.l.google.com:19302" },
        ]
    };
    let rtcPeerConnection = new RTCPeerConnection( config );

    // RTCPeerConnectionオブジェクトのイベントハンドラの構築
    setupRTCPeerConnectionEventHandler( rtcPeerConnection );

    // RTCPeerConnectionオブジェクトのストリームにローカルのメディアストリームを追加
    if( stream )
    {
        stream.getTracks().forEach( ( track ) =>
        {
            rtcPeerConnection.addTrack( track, stream );
        } );
    }
    else
    {
        console.log( "No local stream." );
    }

    return rtcPeerConnection;
}

// RTCPeerConnectionオブジェクトのイベントハンドラの構築
function setupRTCPeerConnectionEventHandler( rtcPeerConnection )
{
    // Negotiation needed イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onnegotiationneeded = () =>
    {
        console.log( "Event : Negotiation needed" );
    };

    // ICE candidate イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onicecandidate = ( event ) =>
    {
        console.log( "Event : ICE candidate" );
        if( event.candidate )
        {   // ICE candidateがある
            console.log( "- ICE candidate : ", event.candidate );

            // Vanilla ICEの場合は、何もしない
            // Trickle ICEの場合は、ICE candidateを相手に送る
        }
        else
        {   // ICE candiateがない = ICE candidate の収集終了。
            console.log( "- ICE candidate : empty" );
        }
    };

    // ICE candidate error イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onicecandidateerror = ( event ) =>
    {
        console.error( "Event : ICE candidate error. error code : ", event.errorCode );
    };

    // ICE gathering state change イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onicegatheringstatechange = () =>
    {
        console.log( "Event : ICE gathering state change" );
        console.log( "- ICE gathering state : ", rtcPeerConnection.iceGatheringState );

        if( "complete" === rtcPeerConnection.iceGatheringState )
        {
            // Vanilla ICEの場合は、ICE candidateを含んだOfferSDP/AnswerSDPを相手に送る
            // Trickle ICEの場合は、何もしない
            
            if( "offer" === rtcPeerConnection.localDescription.type )
            {
                // OfferSDPをサーバーに送信
                console.log( "- Send OfferSDP to server" );
                g_socket.emit( "signaling", { type: "offer", data: rtcPeerConnection.localDescription } );
            }
            else if( "answer" === rtcPeerConnection.localDescription.type )
            {
                // AnswerSDPをサーバーに送信
                console.log( "- Send AnswerSDP to server" );
                g_socket.emit( "signaling", { type: "answer", data: rtcPeerConnection.localDescription } );
            }
            else
            {
                console.error( "Unexpected : Unknown localDescription.type. type = ", rtcPeerConnection.localDescription.type );
            }
        }
    };

    // ICE connection state change イベントが発生したときのイベントハンドラ
     rtcPeerConnection.oniceconnectionstatechange = () =>
    {
        console.log( "Event : ICE connection state change" );
        console.log( "- ICE connection state : ", rtcPeerConnection.iceConnectionState );
    };

    // Signaling state change イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onsignalingstatechange = () =>
    {
        console.log( "Event : Signaling state change" );
        console.log( "- Signaling state : ", rtcPeerConnection.signalingState );
    };

    // Connection state change イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onconnectionstatechange = () =>
    {
        console.log( "Event : Connection state change" );
        console.log( "- Connection state : ", rtcPeerConnection.connectionState );

        if( "failed" === rtcPeerConnection.connectionState )
        {
            console.log( "Call : endPeerConnection()" );
            endPeerConnection( rtcPeerConnection );
        }
    };

    // Track イベントが発生したときのイベントハンドラ
    rtcPeerConnection.ontrack = ( event ) =>
    {
        console.log( "Event : Track" );
        console.log( "- stream", event.streams[0] );
        console.log( "- track", event.track );

        // HTML要素へのリモートメディアストリームの設定
        let stream = event.streams[0];
        let track = event.track;
        if( "video" === track.kind )
        {
            console.log( "Call : setStreamToElement( Video_Remote, stream )" );
            setStreamToElement( g_elementVideoRemote, stream );
        }
        else if( "audio" === track.kind )
        {
            console.log( "Call : setStreamToElement( Audio_Remote, stream )" );
            setStreamToElement( g_elementAudioRemote, stream );
        }
        else
        {
            console.error( "Unexpected : Unknown track kind : ", track.kind );
        }
    };
}

// OfferSDPの作成
function createOfferSDP( rtcPeerConnection )
{
    // OfferSDPの作成
    console.log( "Call : rtcPeerConnection.createOffer()" );
    rtcPeerConnection.createOffer()
        .then( ( sessionDescription ) =>
        {
            // 作成されたOfferSDPををLocalDescriptionに設定
            console.log( "Call : rtcPeerConnection.setLocalDescription()" );
            return rtcPeerConnection.setLocalDescription( sessionDescription );
        } )
        .then( () =>
        {
            // Vanilla ICEの場合は、まだSDPを相手に送らない
            // Trickle ICEの場合は、初期SDPを相手に送る
        } )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
}

// OfferSDPの設定とAnswerSDPの作成
function setOfferSDP_and_createAnswerSDP( rtcPeerConnection, sessionDescription )
{
    console.log( "Call : rtcPeerConnection.setRemoteDescription()" );
    rtcPeerConnection.setRemoteDescription( sessionDescription )
        .then( () =>
        {
            // AnswerSDPの作成
            console.log( "Call : rtcPeerConnection.createAnswer()" );
            return rtcPeerConnection.createAnswer();
        } )
        .then( ( sessionDescription ) =>
        {
            // 作成されたAnswerSDPををLocalDescriptionに設定
            console.log( "Call : rtcPeerConnection.setLocalDescription()" );
            return rtcPeerConnection.setLocalDescription( sessionDescription );
        } )
        .then( () =>
        {
            // Vanilla ICEの場合は、まだSDPを相手に送らない
            // Trickle ICEの場合は、初期SDPを相手に送る
        } )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
}

// AnswerSDPの設定
function setAnswerSDP( rtcPeerConnection, sessionDescription )
{
    console.log( "Call : rtcPeerConnection.setRemoteDescription()" );
    rtcPeerConnection.setRemoteDescription( sessionDescription )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
}

// コネクションの終了処理
function endPeerConnection( rtcPeerConnection )
{
    // リモート映像の停止
    console.log( "Call : setStreamToElement( Video_Remote, null )" );
    setStreamToElement( g_elementVideoRemote, null );
    // リモート音声の停止
    console.log( "Call : setStreamToElement( Audio_Remote, null )" );
    setStreamToElement( g_elementAudioRemote, null );

    // グローバル変数のクリア
    g_rtcPeerConnection = null;

    // ピアコネクションの終了
    rtcPeerConnection.close();
}

// ↓↓↓その他の内部関数↓↓↓

// HTML要素へのメディアストリームの設定
function setStreamToElement( elementMedia, stream )
{
    // メディアストリームを、メディア用のHTML要素のsrcObjに設定する。
    elementMedia.srcObject = stream;

    if( !stream )
    {   
        return;
    }

    // 音量
    if( "VIDEO" === elementMedia.tagName )
    {   // VIDEO：ボリュームゼロ、ミュート
        elementMedia.volume = 0.0;
        elementMedia.muted = true;
    }
    else if( "AUDIO" === elementMedia.tagName )
    {   // AUDIO：ボリュームあり、ミュートでない
        elementMedia.volume = 1.0;
        elementMedia.muted = false;
    }
    else
    {
        console.error( "Unexpected : Unknown ElementTagName : ", elementMedia.tagName );
    }
}