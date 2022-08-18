"use strict";

///////////////////////////////////////////////// グローバル変数 /////////////////////////////////////////////////

const g_elementDivJoinScreen = document.getElementById( "joinScreen" );
const g_elementDivChatScreen = document.getElementById( "talkScreen" );

const g_elementButtonJoin = document.getElementById( "joinBtn" );
const g_elementMenuBar = document.getElementById( "menuBar" );
const g_elementCheckboxCamera = document.getElementById( "camBtn" );
const g_elementCheckboxMicrophone = document.getElementById( "micBtn" );
const g_elementLabelCamera = document.getElementById( "camLabel" );
const g_elementLabelMicrophone = document.getElementById( "micLabel" );
const g_elementButtonQuit = document.getElementById( "quitBtn" );
const g_elementButtonOffer = document.getElementById( "offerBtn" );

const g_elementVideo_host = document.getElementById( "hostVideo" );
const g_elementAudio_host = document.getElementById( "hostAudio" );

const g_elementTextClassName = document.getElementById( "text_classname" );
const g_elementTextMessageForSend = document.getElementById( "text_message_for_send" );
const g_elementTextareaMessageReceived = document.getElementById( "textarea_message_received" )

let g_rtcPeerConnection = null;
let g_selectedClassBtn = null;
let g_selectedClassName = null;
let g_isHost = false;

// クライアントからサーバーへの接続要求
const g_socket = io.connect();


///////////////////////////////////////////////// UIから呼ばれる関数 /////////////////////////////////////////////////

// classNameボタン押下
function onClassNameBtnClicked(e) {
    if( g_selectedClassBtn )
    {
        g_selectedClassBtn.style.background = "#fff";
        g_selectedClassBtn.style.color = "#000";
    }
    e.style.background = "#000";
    e.style.color = "#fff";
    g_selectedClassBtn = e;
    g_elementButtonJoin.disabled = false;
}

// Joinボタン押下
function onJoinBtnClicked()
{
    // サーバーに"join"を送信
    console.log( "- Send 'Join' to server" );
    g_socket.emit( "join", {} );

    g_selectedClassName = g_selectedClassBtn.innerHTML;

    if ( g_selectedClassName === "Host" )
    {
        g_elementLabelCamera.style.display = "inline-block";
        g_elementLabelMicrophone.style.display = "inline-block";
        // g_elementButtonOffer.style.display = "inline-block";
        g_isHost = true;
    }
    
    g_elementTextClassName.value = g_selectedClassName;
    
    g_elementDivJoinScreen.style.display = "none";
    g_elementDivChatScreen.style.display = "block";

    // g_selectedClassBtn.style.textDecoration = "line-through";
    // g_selectedClassBtn.disabled = true;
}

// カメラ / マイクボタン押下
function onCamMicBtnClicked()
{
    if ( g_isHost ) {
        // これまでの状態
        let trackCamera_old = null;
        let trackMicrophone_old = null;
        let bCamera_old = false;
        let bMicrophone_old = false;
        let idCameraTrack_old = "";
        let idMicrophoneTrack_old = "";
        let stream = g_elementVideo_host.srcObject;
        if( stream )
        {
            trackCamera_old = stream.getVideoTracks()[0];
            if( trackCamera_old )
            {
                bCamera_old = true;
                idCameraTrack_old = trackCamera_old.id;
            }
            trackMicrophone_old = stream.getAudioTracks()[0];
            if( trackMicrophone_old )
            {
                bMicrophone_old = true;
                idMicrophoneTrack_old = trackCamera_old.id;
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
        console.log( "Microphone : %s => %s", bMicrophone_old, bMicrophone_new );

        if( bCamera_old === bCamera_new && bMicrophone_old === bMicrophone_new )
        {   // チェックボックスの状態の変化なし
            return;
        }

        if( g_rtcPeerConnection )
        {
            // コネクションオブジェクトに対してTrack削除を行う。
            // （コネクションオブジェクトに対してTrack削除を行わなかった場合、使用していないstream通信が残る。）
            let senders = g_rtcPeerConnection.getSenders();
            senders.forEach( ( sender ) =>
            {
                if( sender.track )
                {
                    if( idCameraTrack_old === sender.track.id
                        || idMicrophoneTrack_old === sender.track.id)
                    {
                        g_rtcPeerConnection.removeTrack( sender );
                        // removeTrack()の結果として、通信相手に、streamの「removetrack」イベントが発生する。
                    }
                }
            } );
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
        console.log( "Call : setStreamToElement( hostVideo, null )" );
        setStreamToElement( g_elementVideo_host, null );

        if( !bCamera_new && !bMicrophone_new )
        {   // （チェックボックスの状態の変化があり、かつ、カメラとマイクを両方Offの場合
            return;
        }

        // （チェックボックスの状態の変化があり、かつ、カメラとマイクのどちらかもしくはどちらもOnの場合

        // 自分のメディアストリームを取得する。
        console.log( "Call : navigator.mediaDevices.getUserMedia( video=%s, audio=%s )", bCamera_new, bMicrophone_new );
        navigator.mediaDevices.getUserMedia( { video: bCamera_new, audio: bMicrophone_new } )
            .then( ( stream ) =>
            {
                if( g_rtcPeerConnection )
                {
                // コネクションオブジェクトに対してTrack追加を行う。
                stream.getTracks().forEach( ( track ) =>
                {
                    g_rtcPeerConnection.addTrack( track, stream );
                    // addTrack()の結果として、「Negotiation needed」イベントが発生する。
                } );
                }

                // HTML要素へのメディアストリームの設定
                console.log( "Call : setStreamToElement( hostVideo, stream )" );
                setStreamToElement( g_elementVideo_host, stream );
                console.log( "Call : setStreamToElement( hostAudio, stream )" );
                setStreamToElement( g_elementAudio_host, stream );
                // g_elementButtonOffer.disabled = false;
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
}

// Offerボタン押下
// function onOfferBtnClicked()
// {
//     if( g_rtcPeerConnection )
//     {   // 既にコネクションオブジェクトあり
//         alert( "Connection object already exists." );
//         return;
//     }

//     // RTCPeerConnectionオブジェクトの作成
//     console.log( "Call : createPeerConnection()" );
//     let rtcPeerConnection = createPeerConnection( g_elementVideo_host.srcObject );
//     g_rtcPeerConnection = rtcPeerConnection;    // グローバル変数に設定

//     // DataChannelオブジェクトの作成、DTCPeerConnectionオブジェクトのメンバーに追加。
//     let datachannel = rtcPeerConnection.createDataChannel( "my datachannel" );
//     rtcPeerConnection.datachannel = datachannel;
//     // DataChannelオブジェクトのイベントハンドラの構築
//     console.log( "Call : setupDataChannelEventHandler()" );
//     setupDataChannelEventHandler( rtcPeerConnection );

//     // OfferSDPの作成
//     createOfferSDP( rtcPeerConnection );
// }

// Quitボタン押下
function onQuitBtnClicked()
{
    console.log( "UI Event : 'Leave Chat.' button clicked." );
    if( g_rtcPeerConnection )
    {
        if( isDataChannelOpen( g_rtcPeerConnection ) )
        {   // チャット中
            // チャット離脱の通知をDataChannelを通して相手に直接送信
            console.log( "- Send 'leave' through DataChannel" );
            g_rtcPeerConnection.datachannel.send( JSON.stringify( { type: "leave", data: "" } ) );
        }
        console.log( "Call : endPeerConnection()" );
        endPeerConnection( g_rtcPeerConnection );
    }

    // ユーザー名のクリア
    g_elementTextClassName.value = "";

    // 画面の切り替え
    g_elementDivChatScreen.style.display = "none";  // チャット画面の非表示
    g_elementDivJoinScreen.style.display = "block";  // 参加画面の表示

}

// Send Messageボタン押下
function onsubmitButton_SendMessage()
{
    console.log( "UI Event : 'Send Message' button clicked." );

    if( !g_rtcPeerConnection )
    {   // コネクションオブジェクトがない
        alert( "Connection object does not exist." );
        return;
    }
    if( !isDataChannelOpen( g_rtcPeerConnection ) )
    {   // DataChannelオブジェクトが開いていない
        alert( "Datachannel is not open." );
        return;
    }

    if( !g_elementTextMessageForSend.value )
    {
        alert( "Message for send is empty. Please enter the message for send." );
        return;
    }

    // メッセージをDataChannelを通して相手に直接送信
    console.log( "- Send Message through DataChannel" );
    g_rtcPeerConnection.datachannel.send( JSON.stringify( { type: "message", data: g_elementTextMessageForSend.value } ) );

    // 送信メッセージをメッセージテキストエリアへ追加
    // g_elementTextareaMessageReceived.value = strMessage + "\n" + g_elementTextareaMessageReceived.value; // 一番上に追加
    g_elementTextareaMessageReceived.value += g_elementTextMessageForSend.value + "\n"; // 一番下に追加
    g_elementTextMessageForSend.value = "";
}

// ページを閉じる、再読み込みする、移動する
window.addEventListener( "beforeunload", ( event ) =>
    {
        event.preventDefault(); // 既定の動作のキャンセル

        onQuitBtnClicked();        // チャットからの離脱
        g_socket.disconnect();    // Socket.ioによるサーバーとの接続の切断

        e.returnValue = ""; // Chrome では returnValue を設定する必要がある
        return ""; // Chrome 以外では、return を設定する必要がある
    } 
);

///////////////////////////////////////////////// Socket.IO関連の関数 /////////////////////////////////////////////////

// 接続時、サーバー側は"connection"イベント、クライアント側は"connect"イベントが発生する
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

        // 送信元のSocketID
        let strRemoteSocketID = objData.from;
        console.log( "- from : ", objData.from );

        if( !g_elementTextClassName.value )
        {   // 自身がまだ参加していないときは、"signaling"イベントを無視。
            console.log( "Ignore 'signaling' event because I haven't join yet." );
            return;
        }

        if( "join" === objData.type )
        {
            if( g_rtcPeerConnection )
            {   // 既にコネクションオブジェクトあり
                alert( "Connection object already exists." );
                return;
            }

            // RTCPeerConnectionオブジェクトの作成
            console.log( "Call : createPeerConnection()" );
            let rtcPeerConnection = createPeerConnection( g_elementVideo_host.srcObject, strRemoteSocketID );
            g_rtcPeerConnection = rtcPeerConnection;    // グローバル変数に設定

            // DataChannelの作成
            let datachannel = rtcPeerConnection.createDataChannel( "datachannel" );
            // DataChannelオブジェクトをRTCPeerConnectionオブジェクトのメンバーに追加。
            rtcPeerConnection.datachannel = datachannel;
            // DataChannelオブジェクトのイベントハンドラの構築
            console.log( "Call : setupDataChannelEventHandler()" );
            setupDataChannelEventHandler( rtcPeerConnection );

            // OfferSDPの作成
            console.log( "Call : createOfferSDP()" );
            createOfferSDP( rtcPeerConnection );
        }
        else if( "offer" === objData.type )
        {
            if( g_rtcPeerConnection )
            {   // 既にコネクションオブジェクトあり
                alert( "Connection object already exists." );
                return;
            }

            // RTCPeerConnectionオブジェクトの作成
            console.log( "Call : createPeerConnection()" );
            let rtcPeerConnection = createPeerConnection( g_elementVideo_host.srcObject );
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
        else if( "candidate" === objData.type )
        {
            if( !g_rtcPeerConnection )
            {   // コネクションオブジェクトがない
                alert( "Connection object does not exist." );
                return;
            }

            // Vanilla ICEの場合は、ここには来ない。
            // Trickle ICEの場合は、相手側のICE candidateイベントで送信されたICE candidateを、コネクションに追加する。

            // ICE candidateの追加
            console.log( "Call : addCandidate()" );
            addCandidate( g_rtcPeerConnection, objData.data );   // 受信したICE candidateの追加
        }
        else
        {
            console.error( "Unexpected : Socket Event : signaling" );
        }
    } );

    
///////////////////////////////////////////////// DataChannel関連の関数 /////////////////////////////////////////////////

// DataChannelオブジェクトのイベントハンドラの構築
function setupDataChannelEventHandler( rtcPeerConnection )
{
    if( !( "datachannel" in rtcPeerConnection ) )
    {
        console.error( "Unexpected : DataChannel does not exist." );
        return;
    }

    // message イベントが発生したときのイベントハンドラ
    rtcPeerConnection.datachannel.onmessage = ( event ) =>
    {
        console.log( "DataChannel Event : message" );
        let objData = JSON.parse( event.data );
        console.log( "- type : ", objData.type );
        console.log( "- data : ", objData.data );

        if( "message" === objData.type )
        {
            // 受信メッセージをメッセージテキストエリアへ追加
            let strMessage = objData.data;
            // g_elementTextareaMessageReceived.value = strMessage + "\n" + g_elementTextareaMessageReceived.value; // 一番上に追加
            g_elementTextareaMessageReceived.value += strMessage + "\n";  // 一番下に追加
        }
        else if( "offer" === objData.type )
        {
            // 受信したOfferSDPの設定とAnswerSDPの作成
            console.log( "Call : setOfferSDP_and_createAnswerSDP()" );
            setOfferSDP_and_createAnswerSDP( rtcPeerConnection, objData.data );
        }
        else if( "answer" === objData.type )
        {
            // 受信したAnswerSDPの設定
            console.log( "Call : setAnswerSDP()" );
            setAnswerSDP( rtcPeerConnection, objData.data );
        }
        else if( "candidate" === objData.type )
        {
            // 受信したICE candidateの追加
            console.log( "Call : addCandidate()" );
            addCandidate( rtcPeerConnection, objData.data );
        }
        else if( "leave" === objData.type )
        {
            console.log( "Call : endPeerConnection()" );
            endPeerConnection( rtcPeerConnection );
        }
    }
}

// DataChannelが開いているか
function isDataChannelOpen( rtcPeerConnection )
{
    if( !( "datachannel" in rtcPeerConnection ) )
    {   // datachannelメンバーが存在しない
        return false;
    }
    if( !rtcPeerConnection.datachannel )
    {   // datachannelメンバーがnull
        return false;
    }
    if( "open" !== rtcPeerConnection.datachannel.readyState )
    {   // datachannelメンバーはあるが、"open"でない。
        return false;
    }
    // DataCchannelが開いている
    return true;
}


///////////////////////////////////////////////// RTCPeerConnection関連の関数 /////////////////////////////////////////////////

// RTCPeerConnectionオブジェクトの作成
function createPeerConnection( stream, strRemoteSocketID )
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

    // チャット相手のSocketIDをRTCPeerConnectionオブジェクトのメンバーに追加。
    rtcPeerConnection.strRemoteSocketID = strRemoteSocketID;

    return rtcPeerConnection;
}

// RTCPeerConnectionオブジェクトのイベントハンドラの構築
function setupRTCPeerConnectionEventHandler( rtcPeerConnection )
{
    // Negotiation needed イベントが発生したときのイベントハンドラ
    rtcPeerConnection.onnegotiationneeded = () =>
    {
        console.log( "Event : Negotiation needed" );

        if( !isDataChannelOpen( rtcPeerConnection ) )
        {   // チャット前
            // OfferSDPの作成は、ユーザーイベントから直接呼び出すので、Negotiation Neededイベントは無視する。
        }
        else
        {   // チャット中
            // OfferSDPを作成し、DataChannelを通して相手に直接送信
            console.log( "Call : createOfferSDP()" );
            createOfferSDP( rtcPeerConnection );
        }
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

            if( !isDataChannelOpen( rtcPeerConnection ) )
            {   // チャット前
                // ICE candidateをサーバーを経由して相手に送信
                console.log( "- Send ICE candidate to server" );
                g_socket.emit( "signaling", { to: rtcPeerConnection.strRemoteSocketID, 
                                              type: "candidate", 
                                              data: event.candidate 
                } );
            }
            else
            {   // チャット中
                // ICE candidateをDataChannelを通して相手に直接送信
                console.log( "- Send ICE candidate through DataChannel" );
                rtcPeerConnection.datachannel.send( JSON.stringify( { type: "candidate", data: event.candidate } ) );
            }
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
                // // OfferSDPをサーバーに送信
                // console.log( "- Send OfferSDP to server" );
                // g_socket.emit( "signaling", { type: "offer", data: rtcPeerConnection.localDescription } );
            }
            else if( "answer" === rtcPeerConnection.localDescription.type )
            {
                // AnswerSDPをサーバーに送信
                // console.log( "- Send AnswerSDP to server" );
                // g_socket.emit( "signaling", { type: "answer", data: rtcPeerConnection.localDescription } );
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
            console.log( "Call : setStreamToElement( Video_host, stream )" );
            setStreamToElement( g_elementVideo_host, stream );
        }
        else if( "audio" === track.kind )
        {
            console.log( "Call : setStreamToElement( Audio_host, stream )" );
            setStreamToElement( g_elementAudio_host, stream );
        }
        else
        {
            console.error( "Unexpected : Unknown track kind : ", track.kind );
        }

        // 相手のメディアストリームがRTCPeerConnectionから削除されたときのイベントハンドラ
        stream.onremovetrack = ( evt ) =>
        {
            console.log( "Stream Event : remove track" );
            console.log( "- stream", stream );
            console.log( "- track", evt.track );

            // HTML要素のメディアストリームの解除
            let trackRemove = evt.track;
            if( "video" === trackRemove.kind )
            {
                console.log( "Call : setStreamToElement( Video_host, null )" );
                setStreamToElement( g_elementVideo_host, null );
            }
            else if( "audio" === trackRemove.kind )
            {
                console.log( "Call : setStreamToElement( Audio_host, null )" );
                setStreamToElement( g_elementAudio_host, null );
            }
            else
            {
                console.error( "Unexpected : Unknown track kind : ", trackRemove.kind );
            }
        };
    };

    // Data channel イベントが発生したときのイベントハンドラ
    rtcPeerConnection.ondatachannel = ( event ) =>
    {
        console.log( "Event : Data channel" );

        // DataChannelオブジェクトをRTCPeerConnectionオブジェクトのメンバーに追加。
        rtcPeerConnection.datachannel = event.channel;
        // DataChannelオブジェクトのイベントハンドラの構築
        console.log( "Call : setupDataChannelEventHandler()" );
        setupDataChannelEventHandler( rtcPeerConnection );
    };
}

// ICE candidateの追加
function addCandidate( rtcPeerConnection, candidate )
{
    console.log( "Call : rtcPeerConnection.addIceCandidate()" );
    rtcPeerConnection.addIceCandidate( candidate )
        .catch( ( error ) =>
        {
            console.error( "Error : ", error );
        } );
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
            if( !isDataChannelOpen( rtcPeerConnection ) )
            {   // チャット前
                // 初期OfferSDPをサーバーを経由して相手に送信
                console.log( "- Send OfferSDP to server" );
                g_socket.emit( "signaling", { to: rtcPeerConnection.strRemoteSocketID, type: "offer",
                                              data: rtcPeerConnection.localDescription, username: g_elementTextClassName.value } );
            }
            else
            {   // チャット中
                // 初期OfferSDPをDataChannelを通して相手に直接送信
                console.log( "- Send OfferSDP through DataChannel" );
                rtcPeerConnection.datachannel.send( JSON.stringify( { type: "offer", data: rtcPeerConnection.localDescription } ) );
            }
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

            if( !isDataChannelOpen( rtcPeerConnection ) )
            {   // チャット前
                // 初期AnswerSDPをサーバーを経由して相手に送信
                console.log( "- Send AnswerSDP to server" );
                g_socket.emit( "signaling", { to: rtcPeerConnection.strRemoteSocketID, type: "answer",
                                              data: rtcPeerConnection.localDescription, username: g_elementTextClassName.value } );
            }
            else
            {   // チャット中
                // 初期AnswerSDPをDataChannelを通して相手に直接送信
                console.log( "- Send AnswerSDP through DataChannel" );
                rtcPeerConnection.datachannel.send( JSON.stringify( { type: "answer", data: rtcPeerConnection.localDescription } ) );
            }
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
    setStreamToElement( g_elementVideo_host, null );
    // リモート音声の停止
    console.log( "Call : setStreamToElement( Audio_Remote, null )" );
    setStreamToElement( g_elementAudio_host, null );

    // DataChannelの終了
    if( "datachannel" in rtcPeerConnection )
    {
        rtcPeerConnection.datachannel.close();
        rtcPeerConnection.datachannel = null;
    }

    // グローバル変数のクリア
    g_rtcPeerConnection = null;

    // ピアコネクションの終了
    rtcPeerConnection.close();
}

///////////////////////////////////////////////// その他の関数 /////////////////////////////////////////////////

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
        if ( g_isHost )
        {
            elementMedia.volume = 0.0;
            elementMedia.muted = true;
        }
        elementMedia.volume = 1.0;
        elementMedia.muted = false;
    }
    else
    {
        console.error( "Unexpected : Unknown ElementTagName : ", elementMedia.tagName );
    }
}