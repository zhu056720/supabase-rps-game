import React, { useState, useEffect, useRef } from 'react';

// --- 配置區：請放入你的 Supabase 憑證 ---
const SUPABASE_URL = "https://gxhcleurraskwmmksyua.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_UUhv7DQUKWDLf1v31v1ebw_H5Y8ZYnn";

const GAME_STATES = {
  LOBBY: 'LOBBY',
  WAITING_FOR_PLAYER2: 'WAITING_P2',
  PICKING: 'PICKING',
  WAITING_FOR_OPPONENT: 'WAITING_OPP',
  GAME_OVER: 'GAME_OVER'
};

const CHOICES = {
  ROCK: 'rock',
  PAPER: 'paper',
  SCISSORS: 'scissors'
};

// --- 輔助函數：生成 6 位數純數字短房號 ---
function generateSixDigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// --- 自定義安全內聯 SVG 圖標元件 ---
const RefreshCw = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
    <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
    <path d="M16 16h5v5" />
  </svg>
);

const Copy = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const Check = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const Zap = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

const AlertTriangle = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const LogOut = ({ className }) => (
  <svg className={className} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

function HandVisual({ choice, state, size = 'md' }) {
  const emojiMap = {
    [CHOICES.ROCK]: '✊',
    [CHOICES.PAPER]: '✋',
    [CHOICES.SCISSORS]: '✌️'
  };

  const sizeClasses = {
    sm: 'text-4xl w-16 h-16',
    md: 'text-6xl w-24 h-24',
    lg: 'text-8xl w-32 h-32'
  };

  const baseClasses = `flex items-center justify-center rounded-2xl transition-all duration-300 shadow-lg ${sizeClasses[size] || sizeClasses.md}`;

  if (state === 'hidden' || state === 'thinking') {
    return (
      <div className={`${baseClasses} bg-slate-800 border-2 border-slate-700 animate-pulse`}>
        <span className="opacity-50">🤔</span>
      </div>
    );
  }

  if (state === 'ready') {
    return (
      <div className={`${baseClasses} bg-emerald-900/30 border-2 border-emerald-500/50`}>
        <span className="drop-shadow-md">✅</span>
      </div>
    );
  }

  return (
    <div className={`${baseClasses} bg-slate-700 border-2 border-slate-600 hover:scale-105 transform`}>
      <span className="drop-shadow-xl">{choice ? emojiMap[choice] : '❓'}</span>
    </div>
  );
}

export default function App() {
  const [supabase, setSupabase] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isPollingMode, setIsPollingMode] = useState(false);

  const [room, setRoom] = useState(null);
  const [playerRole, setPlayerRole] = useState(null);
  const [localChoice, setLocalChoice] = useState(null);
  const [matchResult, setMatchResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [targetRoomId, setTargetRoomId] = useState('');

  const roomRef = useRef(room);
  useEffect(() => { roomRef.current = room; }, [room]);

  // 1. 動態載入 Supabase SDK
  useEffect(() => {
    const scriptId = 'supabase-cdn-script';
    let script = document.getElementById(scriptId);

    const initSupabase = (url, key) => {
      if (!url || !key || url.includes("YOUR_")) {
        setLoading(false);
        return;
      }
      try {
        if (window.supabase) {
          const client = window.supabase.createClient(url, key);
          setSupabase(client);
        }
      } catch (err) {
        setErrorMsg("Supabase 初始化失敗，請檢查 URL 格式。");
        setLoading(false);
      }
    };

    if (script) {
      if (window.supabase) initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
      return;
    }

    script = document.createElement('script');
    script.id = scriptId;
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.async = true;
    script.crossOrigin = "anonymous";
    script.onload = () => initSupabase(SUPABASE_URL, SUPABASE_ANON_KEY);
    script.onerror = () => {
      setErrorMsg("未能載入 Supabase 核心元件。");
      setLoading(false);
    };
    document.body.appendChild(script);
  }, []);

  // 2. 匿名登入
  useEffect(() => {
    if (!supabase) return;
    async function initAuth() {
      setLoading(true);
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) throw error;
        setUser(data.user);
      } catch (err) {
        setErrorMsg("登入失敗，請確保 Supabase 已開啟 Anonymous Auth。");
      } finally {
        setLoading(false);
      }
    }
    initAuth();
  }, [supabase]);

  // 3. 核心實時更新 (相容長短碼查詢)
  useEffect(() => {
    if (!supabase || !room?.id) return;

    let pollingInterval = null;

    const fetchRoomData = async () => {
      const { data, error } = await supabase
        .from('games')
        .select()
        .eq('id', roomRef.current?.id)
        .single();
      if (data) {
        setRoom(data);
      }
    };

    const channel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'games',
        filter: `id=eq.${room.id}`
      }, (payload) => {
        setRoom(payload.new);
      });

    channel.subscribe((status, err) => {
      if (status === 'CHANNEL_ERROR' || (err && err.message?.includes('WebSocket'))) {
        if (!isPollingMode) {
          setIsPollingMode(true);
          pollingInterval = setInterval(fetchRoomData, 1500);
        }
      }
    });

    return () => {
      if (channel) supabase.removeChannel(channel);
      if (pollingInterval) clearInterval(pollingInterval);
    };
  }, [supabase, room?.id, isPollingMode]);

  // 4. 狀態解析引擎 + 結束時自動更新 status = 'finished'
  useEffect(() => {
    if (!room || !user || !supabase) return;

    const role = user.id === room.p1_id ? 'p1' : 'p2';
    setPlayerRole(role);

    const myChoice = role === 'p1' ? room.p1_choice : room.p2_choice;
    const oppChoice = role === 'p1' ? room.p2_choice : room.p1_choice;
    const oppId = role === 'p1' ? room.p2_id : room.p1_id;

    setLocalChoice(myChoice);

    if (!oppId) {
      setRoom(prev => prev ? { ...prev, localState: GAME_STATES.WAITING_FOR_PLAYER2 } : null);
    } else if (!myChoice && !oppChoice) {
      setRoom(prev => prev ? { ...prev, localState: GAME_STATES.PICKING } : null);
    } else if (myChoice && !oppChoice) {
      setRoom(prev => prev ? { ...prev, localState: GAME_STATES.WAITING_FOR_OPPONENT } : null);
    } else if (!myChoice && oppChoice) {
      setRoom(prev => prev ? { ...prev, localState: GAME_STATES.PICKING } : null);
    } else if (myChoice && oppChoice) {
      calculateWinner(myChoice, oppChoice);
      setRoom(prev => prev ? { ...prev, localState: GAME_STATES.GAME_OVER } : null);

      // 當遊戲分出勝負，且當前房間狀態還是 playing 時，自動更新資料庫狀態為 'finished' 釋放短碼
      if (room.status === 'playing') {
        supabase
          .from('games')
          .update({ status: 'finished' })
          .eq('id', room.id)
          .then(({ error }) => {
            if (error) console.error("更新遊戲結束狀態失敗:", error.message);
          });
      }
    }
  }, [room?.p1_choice, room?.p2_choice, room?.p2_id, room?.status, user?.id, supabase]);

  const calculateWinner = (my, opp) => {
    if (my === opp) { setMatchResult('draw'); return; }
    const winConditions = { [CHOICES.ROCK]: CHOICES.SCISSORS, [CHOICES.PAPER]: CHOICES.ROCK, [CHOICES.SCISSORS]: CHOICES.PAPER };
    setMatchResult(winConditions[my] === opp ? 'win' : 'lose');
  };

  // 【優化】點擊建房：在前端生成隨機 6 位數短碼並寫入 room_code
  const createGame = async () => {
    if (!supabase || !user) return;
    setLoading(true);
    setErrorMsg('');

    const shortCode = generateSixDigitCode();

    const { data, error } = await supabase
      .from('games')
      .insert([{ 
        p1_id: user.id, 
        status: 'waiting', 
        p1_choice: null, 
        p2_choice: null, 
        p2_id: null,
        room_code: shortCode // 儲存 6 位數短房號
      }])
      .select()
      .single();

    if (error) { 
      setErrorMsg(`建房失敗: ${error.message}`); 
      setLoading(false); 
    } else if (data) { 
      setRoom(data); 
      setLoading(false); 
    }
  };

  // 【優化】進房邏輯：同時比對 6 位數 room_code 並且房間狀態必須為 'waiting'
  const joinGame = async (e) => {
    e.preventDefault();
    const inputCode = targetRoomId.trim();
    if (!supabase || !user || !inputCode) return;
    setLoading(true);
    setErrorMsg('');

    // 多重條件查詢：room_code 等於輸入值，且 status 必須是 'waiting'
    const { data: targetRoom, error: fetchError } = await supabase
      .from('games')
      .select()
      .eq('room_code', inputCode)
      .eq('status', 'waiting')
      .maybeSingle(); // 避免多筆符合時崩潰，也更好處理無房間的情況

    if (fetchError || !targetRoom) { 
      setErrorMsg("找不到該有效空房，請確認 6 位數房號是否正確，或房間是否已滿。"); 
      setLoading(false); 
      return; 
    }
    if (targetRoom.p1_id === user.id) { 
      setErrorMsg("不能加入自己創的房。"); 
      setLoading(false); 
      return; 
    }

    const { data: updatedRoom, error: updateError } = await supabase
      .from('games')
      .update({ p2_id: user.id, status: 'playing' })
      .eq('id', targetRoom.id) // 用背後的 UUID 做精確更新
      .select()
      .single();

    if (updateError) {
      setErrorMsg(`加入失敗: ${updateError.message}`);
    } else if (updatedRoom) { 
      setRoom(updatedRoom); 
    }
    setLoading(false);
  };

  const handlePick = async (choice) => {
    if (!supabase || !room || !playerRole) return;
    const updateField = playerRole === 'p1' ? { p1_choice: choice } : { p2_choice: choice };
    await supabase.from('games').update(updateField).eq('id', room.id);
  };

  // 【優化】因為上一局在判定輸贏時 status 已經變成 'finished'
  // 為了安全釋放短碼，點擊「再玩一局」會將玩家帶回主大廳，以便快速建立下一場全新短碼的戰局
  const handlePlayAgain = () => {
    setRoom(null);
    setLocalChoice(null);
    setMatchResult(null);
    setTargetRoomId('');
  };

  if (loading) {
    return (
      <div className="bg-slate-950 min-h-screen text-white flex flex-col items-center justify-center p-6">
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-4 shadow-2xl">
          <RefreshCw className="w-12 h-12 animate-spin text-blue-500 mx-auto" />
          <p className="text-slate-300 font-medium">數據庫同步中...</p>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="bg-slate-950 min-h-screen text-white flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500"></div>
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-2">P2P RPS Clash</h1>
            <p className="text-slate-400 text-sm">極速 6 位數短碼房版</p>
          </div>

          {errorMsg && <div className="p-3 mb-6 bg-rose-950/40 border border-rose-900/50 rounded-xl text-xs text-rose-400 text-center">{errorMsg}</div>}

          <div className="space-y-6">
            <div className="p-5 bg-slate-950/50 border border-slate-800 rounded-2xl text-center space-y-4">
              <Zap className="w-8 h-8 text-blue-400 mx-auto" />
              <button onClick={createGame} className="w-full py-3 bg-blue-600 hover:bg-blue-700 font-bold rounded-xl shadow-lg transition-all text-sm">建立新遊戲局</button>
            </div>
            <div className="relative"><div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-800"></div></div><div className="relative flex justify-center text-xs"><span className="px-2 bg-slate-900 text-slate-500">或</span></div></div>
            <form onSubmit={joinGame} className="space-y-3">
              <input type="text" maxLength={6} placeholder="輸入 6 位數房號..." value={targetRoomId} onChange={(e) => setTargetRoomId(e.target.value.replace(/\D/g, ''))} className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-xl px-4 py-2 text-sm font-mono text-center tracking-[0.2em] outline-none placeholder:tracking-normal" />
              <button type="submit" disabled={targetRoomId.trim().length !== 6} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:hover:bg-purple-600">加入戰局</button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  const currentLocalState = room.localState || GAME_STATES.PICKING;
  const isP1 = playerRole === 'p1';
  const myChoice = isP1 ? room.p1_choice : room.p2_choice;
  const oppChoice = isP1 ? room.p2_choice : room.p1_choice;
  const oppId = isP1 ? room.p2_id : room.p1_id;

  return (
    <div className="flex flex-col min-h-screen bg-slate-950 text-slate-200">
      <header className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/50 backdrop-blur-md">
        <div className="flex items-center space-x-2 text-xs">
          {isPollingMode ? (
            <>
              <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
              <span className="font-bold text-amber-400">Canvas 兼容模式：每 1.5 秒自動同步</span>
            </>
          ) : (
            <>
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="font-bold text-emerald-400">WebSocket 實時連接中</span>
            </>
          )}
        </div>
        <button onClick={() => setRoom(null)} className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />離開房間</button>
      </header>

      <main className="flex-1 flex flex-col max-w-4xl mx-auto w-full p-6">
        <div className="flex-1 flex flex-col items-center justify-center space-y-4">
          <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">對手</h2>
          <HandVisual choice={oppChoice} state={currentLocalState === GAME_STATES.GAME_OVER ? 'revealed' : (oppChoice ? 'ready' : 'thinking')} />
          <div className="h-6 text-sm">
            {!oppId && <span className="text-amber-400 animate-pulse">等待對手輸入 6 位數短碼加入...</span>}
            {oppId && !oppChoice && currentLocalState !== GAME_STATES.GAME_OVER && <span className="text-slate-500">對方考慮中...</span>}
            {oppId && oppChoice && currentLocalState !== GAME_STATES.GAME_OVER && <span className="text-emerald-400 font-bold">對方已就緒 ✅</span>}
          </div>
        </div>

        <div className="py-6 flex justify-center items-center">
          <div className="h-[1px] w-full max-w-md bg-slate-800 relative">
            <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-slate-950 px-3 text-xs font-bold text-slate-600 tracking-widest uppercase">VS</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center space-y-6">
          {currentLocalState === GAME_STATES.WAITING_FOR_PLAYER2 ? (
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-center space-y-3">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">你的遊戲短房號 (複製給朋友)</p>
              <div className="flex items-center justify-center bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-2xl font-bold tracking-[0.25em] text-blue-400 pl-[0.55em]">
                <span>{room.room_code}</span>
                <button onClick={() => { navigator.clipboard.writeText(room.room_code); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="ml-4 p-1.5 bg-slate-800 rounded-lg text-sm tracking-normal">
                  {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-300" />}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">背後 UUID：{room.id}</p>
            </div>
          ) : (
            <>
              <div className="flex space-x-6">
                {Object.values(CHOICES).map((choice) => {
                  const isSelected = myChoice === choice;
                  const isDisabled = currentLocalState !== GAME_STATES.PICKING;
                  return (
                    <button key={choice} onClick={() => handlePick(choice)} disabled={isDisabled} className={`relative transition-all duration-300 ${isDisabled && !isSelected ? 'opacity-30 scale-90 grayscale' : ''} ${isSelected ? 'scale-110 -translate-y-2' : 'hover:scale-105'}`}>
                      <HandVisual choice={choice} state="revealed" size="md" />
                    </button>
                  );
                })}
              </div>
              <h2 className="text-xs font-bold text-blue-500 uppercase tracking-widest">我方 (房號: {room.room_code})</h2>
            </>
          )}
        </div>
      </main>

      {currentLocalState === GAME_STATES.GAME_OVER && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl">
            <h1 className="text-3xl font-black mb-6 animate-bounce">
              {matchResult === 'win' && '🎉 你贏了！'}
              {matchResult === 'lose' && '💀 你輸了'}
              {matchResult === 'draw' && '🤝 平手'}
            </h1>
            <button onClick={handlePlayAgain} className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl font-bold text-white shadow-lg hover:from-blue-600 hover:to-purple-700 transition-all">返回大廳重新挑戰</button>
          </div>
        </div>
      )}
    </div>
  );
}