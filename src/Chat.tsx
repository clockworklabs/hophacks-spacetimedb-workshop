import { useEffect, useState } from "react";
import { useSpacetimeDB } from "./utils/useSpacetimeDB";
import { DbConnection, Message, User } from "./module_bindings";
import { useSubscription, useTable } from "./utils";
import { PrettyMessage } from "./App";

export function Chat() {
  const [newName, setNewName] = useState('');
  const [settingName, setSettingName] = useState(false);
  const [systemMessage, setSystemMessage] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const { client, status, identity, token } = useSpacetimeDB<DbConnection>();
  const messagesSub = useSubscription("SELECT * FROM message");
  const usersSub = useSubscription("SELECT * FROM user");

  const messages = useTable<Message>(client.db.message);
  const users = useTable<User>(client.db.user, {
    onInsert: (user) => {
      if (user.online) {
        const name = user.name || user.identity.toHexString().substring(0, 8);
        setSystemMessage((prev) => prev + `\n${name} has connected.`);
      }
    },
    onUpdate: (oldUser, newUser) => {
      const name = newUser.name || newUser.identity.toHexString().substring(0, 8);
      if (oldUser.online === false && newUser.online === true) {
        setSystemMessage((prev) => prev + `\n${name} has connected.`);
      } else if (oldUser.online === true && newUser.online === false) {
        setSystemMessage((prev) => prev + `\n${name} has disconnected.`);
      }
    },
  });

  const connected = status === 'connected';
  const subscribeToQueries = (conn: DbConnection, queries: string[]) => {
    conn
      ?.subscriptionBuilder()
      .onApplied(() => {
        console.log('SDK client cache initialized.');
      })
      .subscribe(queries);
  };

  const prettyMessages: PrettyMessage[] = messages
    .sort((a, b) => (a.sent > b.sent ? 1 : -1))
    .map(message => ({
      senderName:
        users.get(message.sender.toHexString())?.name ||
        message.sender.toHexString().substring(0, 8),
      text: message.text,
    }));

  if (!connected || !identity) {
    return (
      <div className="App">
        <h1>Connecting...</h1>
      </div>
    );
  }

  const name =
    users.get(identity?.toHexString())?.name ||
    identity?.toHexString().substring(0, 8) ||
    '';

  const onSubmitNewName = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSettingName(false);
    conn.reducers.setName(newName);
  };

  const onMessageSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setNewMessage('');
    conn.reducers.sendMessage(newMessage);
  };
  return (
    <>
      <div className="profile">
        <h1>Profile</h1>
        {!settingName ? (
          <>
            <p>{name}</p>
            <button
              onClick={() => {
                setSettingName(true);
                setNewName(name);
              }}
            >
              Edit Name
            </button>
          </>
        ) : (
          <form onSubmit={onSubmitNewName}>
            <input
              type="text"
              aria-label="name input"
              value={newName}
              onChange={e => setNewName(e.target.value)}
            />
            <button type="submit">Submit</button>
          </form>
        )}
      </div>
      <div className="message">
        <h1>Messages</h1>
        {prettyMessages.length < 1 && <p>No messages</p>}
        <div>
          {prettyMessages.map((message, key) => (
            <div key={key}>
              <p>
                <b>{message.senderName}</b>
              </p>
              <p>{message.text}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="system" style={{ whiteSpace: 'pre-wrap' }}>
        <h1>System</h1>
        <div>
          <p>{systemMessage}</p>
        </div>
      </div>
      <div className="new-message">
        <form
          onSubmit={onMessageSubmit}
          style={{
            display: 'flex',
            flexDirection: 'column',
            width: '50%',
            margin: '0 auto',
          }}
        >
          <h3>New Message</h3>
          <textarea
            aria-label="message input"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
          ></textarea>
          <button type="submit">Send</button>
        </form>
      </div>
    </>
  );
}