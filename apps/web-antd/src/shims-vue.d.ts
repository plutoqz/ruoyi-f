// shims-vue.d.ts
declare module '@stomp/stompjs';
declare module 'sockjs-client/dist/sockjs.min.js' {
  import SockJS from 'sockjs-client';
  export = SockJS;          // 把 min.js 当成 sockjs-client 本身导出
}