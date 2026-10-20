// Tab Tin nhắn nội bộ: chat 1-1 giữa nhân viên (admin/sale), tạo nhóm + thêm người.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../context/StoreContext';
import { Composer, MessageList, fmtTime } from './ChatShared';
import './ChatTabs.css';

function convName(c, meId) {
  if (c.title) return `👥 ${c.title}`;
  const other = c.participants.find((p) => p.id !== meId);
  return other ? `${other.role === 'admin' ? 'Admin' : 'Sale'} ${other.name}` : 'Trò chuyện';
}

export default function InternalChatTab() {
  const { user } = useStore();
  const [convs, setConvs] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selId, setSelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [groupTitle, setGroupTitle] = useState('');
  const [groupMembers, setGroupMembers] = useState([]);
  const [addPick, setAddPick] = useState('');
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    api.chatInternal()
      .then((d) => { setConvs(d.conversations); setStaff(d.staff); setLoadError(''); })
      .catch(() => setLoadError('Không tải được tin nhắn nội bộ'));
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const iv = setInterval(load, 6000);
    return () => clearInterval(iv);
  }, [load]);

  const sel = convs.find((c) => c.id === selId) || null;

  const loadMsgs = useCallback(() => {
    if (!selId) return;
    api.chatMessages(selId).then((d) => setMessages(d.messages)).catch(() => {});
  }, [selId]);
  useEffect(() => { loadMsgs(); }, [loadMsgs]);
  useEffect(() => {
    if (!selId) return undefined;
    const iv = setInterval(loadMsgs, 3000);
    return () => clearInterval(iv);
  }, [selId, loadMsgs]);

  const openDirect = async (uid) => {
    try {
      const d = await api.chatDirect(uid);
      setSelId(d.conversation.id);
      load();
    } catch (e) { alert(e.message); }
  };
  const createGroup = async () => {
    try {
      const d = await api.chatGroup(groupTitle.trim(), groupMembers);
      setGroupTitle(''); setGroupMembers([]);
      setSelId(d.conversation.id);
      load();
    } catch (e) { alert(e.message); }
  };
  const addMember = async () => {
    if (!addPick || !sel) return;
    try {
      await api.chatAddMember(sel.id, Number(addPick));
      setAddPick('');
      load();
    } catch (e) { alert(e.message); }
  };
  const send = async (content) => {
    try { await api.chatSend(selId, content); loadMsgs(); load(); }
    catch (e) { alert(e.message); }
  };

  const directWith = (uid) => convs.find((c) => !c.title && c.participants.length === 2 && c.participants.some((p) => p.id === uid));
  const inSel = sel ? sel.participants.map((p) => p.id) : [];

  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>Tin nhắn nội bộ</h3>
      <p style={{ color: 'var(--muted)', margin: '0 0 14px', fontSize: '0.92rem' }}>
        Chỉ Admin và Sale thấy mục này. Nhắn riêng 1-1 hoặc tạo nhóm để cùng xử lý một việc.
      </p>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <div className="chat-layout">
        <div>
          <div className="chat-list">
            {convs.length === 0 && <p style={{ color: 'var(--muted)' }}>Chưa có cuộc trò chuyện nào.</p>}
            {convs.map((c) => (
              <button key={c.id} type="button" className={`chat-item ${c.id === selId ? 'active' : ''}`} onClick={() => setSelId(c.id)}>
                <div className="chat-item-top">
                  <span className="chat-item-name">{convName(c, user.id)}</span>
                  {c.unread > 0 && <span className="chat-unread-dot">{c.unread}</span>}
                </div>
                <div className="chat-item-last">
                  {c.last_message ? `${c.last_message.sender_name || ''}: ${c.last_message.content}` : 'Chưa có tin nhắn'}
                  {c.last_message ? ` · ${fmtTime(c.last_message.created_at)}` : ''}
                </div>
                {c.title && (
                  <div className="chat-item-people">
                    <span className="chat-chip">{c.participants.length} thành viên: {c.participants.map((p) => p.name).join(', ')}</span>
                  </div>
                )}
              </button>
            ))}
          </div>

          <div className="chat-section-title">Nhắn với nhân viên</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {staff.map((u) => (
              <button key={u.id} type="button" className="chat-item" onClick={() => openDirect(u.id)}>
                <span className="chat-item-name">{u.role === 'admin' ? 'Admin' : 'Sale'} {u.name}</span>
                <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {directWith(u.id) ? ' · Đã có cuộc trò chuyện' : ' · Bấm để nhắn'}
                </span>
              </button>
            ))}
          </div>

          <div className="chat-section-title">Tạo nhóm mới</div>
          <div className="card" style={{ padding: 14 }}>
            <div className="field">
              <label htmlFor="internalchat-ten-nhom">Tên nhóm</label>
              <input id="internalchat-ten-nhom" value={groupTitle} onChange={(e) => setGroupTitle(e.target.value)} placeholder="VD: Xử lý đơn hoàn tuần này" />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
              {staff.map((u) => (
                <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 9, cursor: 'pointer' }}>
                  <input type="checkbox" className="cart-check"
                    checked={groupMembers.includes(u.id)}
                    onChange={(e) => setGroupMembers((prev) => e.target.checked ? [...prev, u.id] : prev.filter((x) => x !== u.id))} />
                  <span>{u.role === 'admin' ? 'Admin' : 'Sale'} {u.name}</span>
                </label>
              ))}
            </div>
            <button className="btn btn-primary" disabled={!groupTitle.trim() || groupMembers.length === 0} onClick={createGroup}>
              Tạo nhóm
            </button>
          </div>
        </div>

        <div className="chat-pane">
          {!sel ? (
            <p className="chat-empty">Chọn một cuộc trò chuyện, hoặc bấm vào tên nhân viên để bắt đầu nhắn.</p>
          ) : (
            <>
              <div className="chat-pane-head">
                <h3>{convName(sel, user.id)}</h3>
                <span style={{ flex: 1 }} />
                {staff.filter((u) => !inSel.includes(u.id)).length > 0 && (
                  <>
                    <select value={addPick} onChange={(e) => setAddPick(e.target.value)}
                      style={{ padding: '7px 10px', borderRadius: 8, background: 'rgba(12,8,5,.6)', color: 'var(--text)', border: '1px solid rgba(232,181,106,.3)' }}>
                      <option value="">＋ Thêm người...</option>
                      {staff.filter((u) => !inSel.includes(u.id)).map((u) => (
                        <option key={u.id} value={u.id}>{u.role === 'admin' ? 'Admin' : 'Sale'} {u.name}</option>
                      ))}
                    </select>
                    <button className="btn btn-small btn-outline" disabled={!addPick} onClick={addMember}>Thêm</button>
                  </>
                )}
              </div>
              {sel.participants.length > 0 && (
                <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(232,181,106,.12)', display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                  {sel.participants.map((p) => (
                    <span key={p.id} className="chat-chip">
                      {p.role === 'admin' ? 'Admin' : p.role === 'sale' ? 'Sale' : ''} {p.name}{p.id === user.id ? ' (bạn)' : ''}
                    </span>
                  ))}
                </div>
              )}
              <MessageList messages={messages} meId={user.id} />
              <Composer onSend={send} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
