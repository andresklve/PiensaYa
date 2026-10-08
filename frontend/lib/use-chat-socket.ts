'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { SERVICES } from './api';
import { getSession } from './session';
import { Message } from './types';

// Un solo socket al namespace /chat del Chat Service; el token va en el handshake.
export function useChatSocket(onMessage: (message: Message) => void) {
  const [connected, setConnected] = useState(false);
  const handler = useRef(onMessage);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    handler.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    const token = getSession()?.accessToken;
    if (!token) return;

    const socket = io(`${SERVICES.chat}/chat`, {
      auth: { token },
      transports: ['websocket'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('new_message', (message: Message) => handler.current(message));

    return () => {
      socket.close();
      socketRef.current = null;
    };
  }, []);

  async function sendMessage(toUserId: string, content: string) {
    const socket = socketRef.current;
    if (!socket?.connected) throw new Error('Socket desconectado');

    const ack = await socket.emitWithAck('send_message', { toUserId, content });
    if (ack?.status !== 'ok') {
      throw new Error(ack?.message ?? 'No se pudo enviar el mensaje');
    }
    return ack.message as Message;
  }

  return { connected, sendMessage };
}
