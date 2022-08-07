"use strict";

// モジュール
const express = require( "express" );
const http = require( "http" );
const socketIO = require( "socket.io" );

// オブジェクトと定数宣言
const app = express();
const server = http.Server( app );
const PORT = process.env.PORT || 1337;
const io = socketIO( server );


// 接続時の処理
// (接続が確立すると、サーバー側で、"connection"イベント,クライアント側で、"connect"イベントが発生)
io.on(
    "connection",
    ( socket ) =>
    {
        console.log( "connection : ", socket.id );

        // 切断時の処理
        // ・クライアントが切断したら、サーバー側では"disconnect"イベントが発生する
        socket.on(
            "disconnect",
            () =>
            {
                console.log( "disconnect : ", socket.id );
            } );

        // signalingデータ受信時の処理
        // ・クライアント側のsignalingデータ送信「socket.emit( "signaling", objData );」に対する処理
        socket.on(
            "signaling",
            ( objData ) =>
            {
                console.log( "signaling : ", socket.id );
                console.log( "- type : ", objData.type );

                // 送信元以外の全員に送信
                socket.broadcast.emit( "signaling", objData );
            } );
    } );

// 公開フォルダ指定
app.use( express.static( __dirname + "/public" ) );

// サーバーの起動
server.listen(
    PORT,
    () =>
    {
        console.log( "Server on port %d", PORT );
    } );
