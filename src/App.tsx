import React, { useEffect, useState } from 'react';
import './App.css';
import {
  DbConnection,
  ErrorContext,
  EventContext,
  Message,
  User,
} from './module_bindings';
import { Identity } from '@clockworklabs/spacetimedb-sdk';
import { SpacetimeDBProvider, useSpacetimeDB } from './utils';
import { Chat } from './Chat';

export type PrettyMessage = {
  senderName: string;
  text: string;
};

function useMessages(conn: DbConnection | null): Message[] {
  const [messages, setMessages] = useState<Message[]>([]);

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, message: Message) => {
      setMessages(prev => [...prev, message]);
    };
    conn.db.message.onInsert(onInsert);

    const onDelete = (_ctx: EventContext, message: Message) => {
      setMessages(prev =>
        prev.filter(
          m =>
            m.text !== message.text &&
            m.sent !== message.sent &&
            m.sender !== message.sender
        )
      );
    };
    conn.db.message.onDelete(onDelete);

    return () => {
      conn.db.message.removeOnInsert(onInsert);
      conn.db.message.removeOnDelete(onDelete);
    };
  }, [conn]);

  return messages;
}

function useUsers(conn: DbConnection | null): Map<string, User> {
  const [users, setUsers] = useState<Map<string, User>>(new Map());

  useEffect(() => {
    if (!conn) return;
    const onInsert = (_ctx: EventContext, user: User) => {
      setUsers(prev => new Map(prev.set(user.identity.toHexString(), user)));
    };
    conn.db.user.onInsert(onInsert);

    const onUpdate = (_ctx: EventContext, oldUser: User, newUser: User) => {
      setUsers(prev => {
        prev.delete(oldUser.identity.toHexString());
        return new Map(prev.set(newUser.identity.toHexString(), newUser));
      });
    };
    conn.db.user.onUpdate(onUpdate);

    const onDelete = (_ctx: EventContext, user: User) => {
      setUsers(prev => {
        prev.delete(user.identity.toHexString());
        return new Map(prev);
      });
    };
    conn.db.user.onDelete(onDelete);

    return () => {
      conn.db.user.removeOnInsert(onInsert);
      conn.db.user.removeOnUpdate(onUpdate);
      conn.db.user.removeOnDelete(onDelete);
    };
  }, [conn]);

  return users;
}

function App() {
  const onConnect = (
    conn: DbConnection,
    identity: Identity,
    token: string
  ) => {
    localStorage.setItem('auth_token', token);
    console.log(
      'Connected to SpacetimeDB with identity:',
      identity.toHexString()
    );
    conn.reducers.onSendMessage(() => {
      console.log('Message sent.');
    });
  };

  const onDisconnect = () => {
    console.log('Disconnected from SpacetimeDB');
  };

  const onConnectError = (_ctx: ErrorContext, err: Error) => {
    console.log('Error connecting to SpacetimeDB:', err);
  };

  return (
    <SpacetimeDBProvider 
      token={localStorage.getItem('auth_token') || ''}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      onConnectError={onConnectError}
      moduleName={'hophacks-chat'}
      uri={'ws://localhost:3000'}
    >
      <div className="App">
        <Chat />
      </div>
    </SpacetimeDBProvider>
  );
}

export default App;
