"use strict";

// グローバル変数の宣言
const element_camBtn = document.getElementById( "camBtn" );
const element_micBtn = document.getElementById( "micBtn" );
const element_usersVideo = document.getElementById( "usersVideo" );
let g_rtcPeerConnection = null;
const g_elementVideoRemote = document.getElementById( "video_remote" );
const g_elementAudioRemote = document.getElementById( "audio_remote" );

// クライアントからサーバーへの接続要求
const g_socket = io.connect();

// カメラ/マイクボタン押下時に呼ばれる関数
function onCamMicBtnClicked()
{
    console.log( "UI Event : Camera/Microphone botton clicked." );

    let old_trackCam = null;
    let old_trackMic = null;
    let old_bCam = false;
    let old_bMic = false;
    let stream = element_usersVideo.srcObject;

    // イベント発火時の状態を収集
    if( stream )
    {
        old_trackCam = stream.getVideoTracks()[0];
        if( old_trackCam )
        {
            old_bCam = true;
        }
        old_trackMic = stream.getAudioTracks()[0];
        if( old_trackMic )
        {
            old_bMic = true;
        }
    }
    // 次の状態を決定
    let new_bCam = false;
    if( element_camBtn.checked )
    {
        new_bCam = true;
    }
    let new_bMic = false;
    if( element_micBtn.checked )
    {
        new_bMic = true;
    }

    console.log( "Camera :  %s => %s", old_bCam, new_bCam );
    console.log( "Microphone : %s => %s", old_bMic, new_bMic );

    if( old_bCam === new_bCam && old_bMic === new_bMic )
    {   // チェックボックスの状態の変化なし
        return;
    }

    // 古いメディアストリームのトラックの停止（HTML要素のstreamの解除だけではカメラは停止しない）
    if( old_trackCam )
    {
        old_trackCam.stop();
    }
    if( old_trackMic )
    {
        old_trackMic.stop();
    }

    // HTML要素のメディアストリームの解除
    setStreamToElement( element_usersVideo, null );

    if( !new_bCam && !new_bMic )
    {   // カメラとマイクを両方Offの場合
        return; // 終了
    }

    // カメラとマイクのどちらかもしくはどちらもOnの場合
    navigator.mediaDevices.getUserMedia( { video: new_bCam, audio: new_bMic } )
        .then( ( stream ) =>
        {
            // HTML要素へのメディアストリームの設定
            setStreamToElement( element_usersVideo, stream );
        } )
        .catch( ( error ) =>
        {
            // メディアストリームの取得に失敗⇒古いメディアストリームのまま。チェックボックスの状態を戻す。
            console.error( "Error : ", error );
            alert( "Could not start Camera." );
            element_camBtn.checked = false;
            element_micBtn.checked = false;
            return;
        } );
}

// RTCPeerConnectionオブジェクトのイベントハンドラの構築
function setupRTCPeerConnectionEventHandler( rtcPeerConnection )
{
    rtcPeerConnection.onnegotiationneeded = () =>
    {
        console.log( "Event : Negotiation needed" );
    };

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

    rtcPeerConnection.onicecandidateerror = ( event ) =>
    {
        console.error( "Event : ICE candidate error. error code : ", event.errorCode );
    };

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

    rtcPeerConnection.oniceconnectionstatechange = () =>
    {
        console.log( "Event : ICE connection state change" );
        console.log( "- ICE connection state : ", rtcPeerConnection.iceConnectionState );
    };

    rtcPeerConnection.onsignalingstatechange = () =>
    {
        console.log( "Event : Signaling state change" );
        console.log( "- Signaling state : ", rtcPeerConnection.signalingState );
    };

    rtcPeerConnection.onconnectionstatechange = () =>
    {
        console.log( "Event : Connection state change" );
        console.log( "- Connection state : ", rtcPeerConnection.connectionState );
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

// 「Send OfferSDP.」ボタンを押すと呼ばれる関数
function onclickButton_SendOfferSDP()
{
    console.log( "UI Event : 'Send OfferSDP.' button clicked." );

    // onclickButton_CreateOfferSDP()と同様の処理

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

// RTCPeerConnectionオブジェクトの作成
function createPeerConnection( stream )
{
    // RTCPeerConnectionオブジェクトの生成
    let config = { "iceServers": [] };
    let rtcPeerConnection = new RTCPeerConnection( config );

    // RTCPeerConnectionオブジェクトのイベントハンドラの構築
    setupRTCPeerConnectionEventHandler( rtcPeerConnection );

    // RTCPeerConnectionオブジェクトのストリームにローカルのメディアストリームを追加
    if( stream )
    {
        // - 古くは、RTCPeerConnection.addStream(stream) を使用していたが、廃止予定となった。
        //   現在は、RTCPeerConnection.addTrack(track, stream) を使用する。
        stream.getTracks().forEach( ( track ) =>
        {
            rtcPeerConnection.addTrack( track, stream );
        } );
    }
    else
    {
        console.log( "No local stream." );
    }
};
// メディアストリームの設定
function setStreamToElement( elementMedia, stream )
{
    // メディアストリームを、メディア用のHTML要素のsrcObjに設定する。
    elementMedia.srcObject = stream;

    if( !stream )
    {   // メディアストリームの設定解除の場合は、ここで処理終了
        return;
    }

    // 音量
    if( "VIDEO" === elementMedia.tagName )
    {   // 動画をボリュームゼロにしてさらにミュート
        elementMedia.volume = 0.0;
        elementMedia.muted = true;
    }
    else if( "AUDIO" === elementMedia.tagName )
    {   // 音声をボリューム100にしてミュート解除
        elementMedia.volume = 1.0;
        elementMedia.muted = false;
    }
    else
    {
        console.error( "Unexpected : Unknown ElementTagName : ", elementMedia.tagName );
    }
}