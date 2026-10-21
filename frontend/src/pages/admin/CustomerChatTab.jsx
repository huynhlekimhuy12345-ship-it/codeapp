// Tab Chat khách hàng: danh sách cuộc trò chuyện (đang chờ -> đang mở -> đã đóng),
// nhân viên Nhận/Tham gia (tối đa 2 người), nhắn 2 chiều, Kết thúc cuộc.
import { useCallback, useEffect, useState } from 'react';
import { api } from '../../api';
import { useStore } from '../../context/StoreContext';
import { Composer, MessageList, fmtTime } from './ChatShared';
import './ChatTabs.css';

function statusChip(c) {
  if (c.status === 'waiting') return <span className="chat-chip waiting">● Đang chờ nhận</span>;
  if (c.status === 'active') return <span className="chat-chip open">● Đang mở</span>;
  return <span className="chat-chip closed">Đã đóng</span>;
}

export default function CustomerChatTab() {
  const { user } = useStore();
  const [list, setList] = useState([]);
  const [selId, setSelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [closing, setClosing] = useState(false);
  const [loadError, setLoadError] = useState('');

  const loadList = useCallback(() => {
    api.chatCustomerList()
      .then((d) => { setList(d.conversations); setLoadError(''); })
      .catch(() => setLoadError('Không tải được danh sách chat'));
  }, []);
  useEffect(() => { loadList(); }, [loadList]);
  useEffect(() => {
    const iv = setInterval(loadList, 5000);
    return () => clearInterval(iv);
  }, [loadList]);

  const sel = list.find((c) => c.id === selId) || null;

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

  const accept = async (id) => {
    try { await api.chatAccept(id); setSelId(id); loadList(); loadMsgs(); }
    catch (e) { alert(e.message); }
  };
  const doClose = async () => {
    try { await api.chatClose(selId); } catch (e) { alert(e.message); }
    setClosing(false);
    loadList();
  };
  const send = async (content) => {
    try { await api.chatSend(selId, content); loadMsgs(); loadList(); }
    catch (e) { alert(e.message); }
  };

  // Bấm "Mở đơn hậu mãi" trên thẻ trong chat -> ghi nhớ đơn đích rồi báo Admin chuyển tab
  const openRequest = (data) => {
    try {
      sessionStorage.setItem('bi99_open_aftersales', JSON.stringify({ refType: data.ref_type, refId: data.id }));
    } catch (e) { /* bỏ qua */ }
    window.dispatchEvent(new CustomEvent('bi99:goto-aftersales'));
  };

  const iAmIn = sel ? sel.staff_participants.some((p) => p.id === user.id) : false;
  const canSend = sel && sel.status === 'active' && iAmIn;

  return (
    <div>
      <h3 style={{ marginBottom: 6 }}>Chat khách hàng</h3>
      <p style={{ color: 'var(--muted)', margin: '0 0 14px', fontSize: '0.92rem' }}>
        Khách gửi yêu cầu chat trên web sẽ hiện ở đây (trạng thái Đang chờ). Bấm <b>Nhận</b> để mở chat với khách — tối đa 2 nhân viên mỗi cuộc.
      </p>
      {loadError && <div className="alert alert-error">{loadError}</div>}
      <div className="chat-layout">
        <div className="chat-list">
          {list.length === 0 && <p style={{ color: 'var(--muted)' }}>Chưa có cuộc trò chuyện nào.</p>}
          {list.map((c) => (
            <button key={c.id} type="button" className={`chat-item ${c.id === selId ? 'active' : ''}`} onClick={() => setSelId(c.id)}>
              <div className="chat-item-top">
                <span className="chat-item-name">👤 {c.customer?.name || 'Khách'}</span>
                {c.unread > 0 && <span className="chat-unread-dot">{c.unread}</span>}
              </div>
              <div className="chat-item-last">
                {c.last_message ? `${c.last_message.sender_name || ''}: ${c.last_message.content}` : '—'}
                {c.last_message ? ` · ${fmtTime(c.last_message.created_at)}` : ''}
              </div>
              <div className="chat-item-people">
                {statusChip(c)}
                {c.staff_participants.map((p) => (
                  <span key={p.id} className="chat-chip">{p.role === 'admin' ? 'Admin' : 'Sale'} {p.name} đang trao đổi</span>
                ))}
              </div>
            </button>
          ))}
        </div>

        <div className="chat-pane">
          {!sel ? (
            <p className="chat-empty">Chọn một cuộc trò chuyện ở cột trái để xem.</p>
          ) : (
            <>
              <div className="chat-pane-head">
                <h3>👤 {sel.customer?.name || 'Khách'}</h3>
                {statusChip(sel)}
                <span style={{ flex: 1 }} />
                {sel.status === 'waiting' && (
                  <button className="btn btn-primary btn-small" onClick={() => accept(sel.id)}>Nhận cuộc trò chuyện</button>
                )}
                {sel.status === 'active' && !iAmIn && sel.staff_participants.length < 2 && (
                  <button className="btn btn-primary btn-small" onClick={() => accept(sel.id)}>Tham gia hỗ trợ</button>
                )}
                {sel.status === 'active' && iAmIn && (
                  <button className="btn btn-small btn-danger-outline" onClick={() => setClosing(true)}>Kết thúc cuộc trò chuyện</button>
                )}
              </div>
              <MessageList messages={messages} meId={user.id} onOpenRequest={openRequest} />
              {canSend ? (
                <Composer onSend={send} />
              ) : (
                <p style={{ padding: '12px 16px', color: 'var(--muted)', borderTop: '1px solid rgba(232,181,106,.18)', margin: 0, fontSize: '0.9rem' }}>
                  {sel.status === 'waiting'
                    ? 'Cuộc trò chuyện đang chờ — bấm "Nhận cuộc trò chuyện" để bắt đầu nhắn với khách.'
                    : sel.status === 'closed'
                      ? 'Cuộc trò chuyện đã kết thúc.'
                      : sel.staff_participants.length >= 2
                        ? `Đã đủ 2 nhân viên trong cuộc: ${sel.staff_participants.map((p) => p.name).join(', ')}.`
                        : 'Bấm "Tham gia hỗ trợ" để nhắn trong cuộc này.'}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {closing && sel && (
        <div className="modal-overlay" onClick={() => setClosing(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3>Kết thúc cuộc trò chuyện?</h3>
            <p style={{ color: 'var(--muted)', lineHeight: 1.6 }}>
              Khách {sel.customer?.name || ''} sẽ không nhắn tiếp được trong cuộc này (họ có thể gửi yêu cầu mới).
            </p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setClosing(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={doClose}>Kết thúc</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
