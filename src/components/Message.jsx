import React from 'react';

export default function Message({ role, content }) {
  return (
    <div className={`msg msg--${role}`}>
      <div className="msg__role">{role}</div>
      <div className="msg__content">{content}</div>
    </div>
  );
}