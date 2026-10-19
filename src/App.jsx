import React, { useState, useEffect, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Settings, Zap, Terminal, X, RefreshCw } from 'lucide-react';

const BackgroundGeolocation = registerPlugin('BackgroundGeolocation');

const firebaseConfig = {
  apiKey: "AIzaSyCF_wZ_PaIg4cm_5hQkRQMcXGF8grfYIck",
  authDomain: "dokyo-92942.firebaseapp.com",
  projectId: "dokyo-92942",
  storageBucket: "dokyo-92942.firebasestorage.app",
  messagingSenderId: "461707894791",
  appId: "1:461707894791:web:2a3e20aab5944d7f8b0aa2",
  measurementId: "G-8W0MC48TFW"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const TRIP_DOC_REF = doc(db, 'trips', 'tokyo_2026_1031');

// 명조 캐릭터 10종 및 실제 SD 일러스트 아바타 링크 매핑
const WUTHERING_CHARACTERS = [
  { name: '금희', emoji: '👑', status: '금장 공명자 ⚡', img: 'https://api.iconify.design/noto:crown.svg' },
  { name: '음림', emoji: '🦊', status: '잔향 주파수 스캔 🔍', img: 'https://api.iconify.design/noto:fox.svg' },
  { name: '장리', emoji: '🔥', status: '홍련의 심판 대기 🌸', img: 'https://api.iconify.design/noto:fire.svg' },
  { name: '금장', emoji: '⚔️', status: '전술 지휘 중 🎯', img: 'https://api.iconify.design/noto:crossed-swords.svg' },
  { name: '카카루', emoji: '⚡', status: '뇌전뢰격 모드 ⚡', img: 'https://api.iconify.design/noto:high-voltage.svg' },
  { name: '엔코', emoji: '🐾', status: '간식 탐색 중 🍎', img: 'https://api.iconify.design/noto:cat-face.svg' },
  { name: '양양', emoji: '🍃', status: '바람의 인도 🍃', img: 'https://api.iconify.design/noto:leaf-fluttering-in-wind.svg' },
  { name: '치샤', emoji: '🔫', status: '권총 사격 훈련 🎯', img: 'https://api.iconify.design/noto:pistol.svg' },
  { name: '도기', emoji: '🛡️', status: '방어선 구축 🛡️', img: 'https://api.iconify.design/noto:shield.svg' },
  { name: '방랑자', emoji: '✨', status: '차원 경계 탐색 🌀', img: 'https://api.iconify.design/noto:glowing-star.svg' },
];

const INITIAL_MEMBERS = {
  m1: { id: 'm1', name: '김현일', emoji: '👑', img: 'https://api.iconify.design/noto:crown.svg', lat: 35.6938, lng: 139.7034, status: '금장 공명자 ⚡' },
  m2: { id: 'm2', name: '손민호', emoji: '🦊', img: 'https://api.iconify.design/noto:fox.svg', lat: 35.6984, lng: 139.7731, status: '잔향 주파수 스캔 🔍' },
  m3: { id: 'm3', name: '김현태', emoji: '🔥', img: 'https://api.iconify.design/noto:fire.svg', lat: 35.6580, lng: 139.7016, status: '홍련의 심판 대기 🌸' },
  m4: { id: 'm4', name: '김세진', emoji: '⚔️', img: 'https://api.iconify.design/noto:crossed-swords.svg', lat: 35.7148, lng: 139.7967, status: '전술 지휘 중 🎯' },
};

export default function App() {
  const [activeMemberId, setActiveMemberId] = useState(() => localStorage.getItem('my_member_id') || 'm1');
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [isBgTracking, setIsBgTracking] = useState(false);
  const [bgLog, setBgLog] = useState('시스템 대기 중...');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editImg, setEditImg] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const watcherIdRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  const activeMember = members[activeMemberId] || members.m1;

  useEffect(() => {
    if (members[activeMemberId]) {
      setEditName(members[activeMemberId].name);
      setEditEmoji(members[activeMemberId].emoji);
      setEditImg(members[activeMemberId].img || WUTHERING_CHARACTERS[0].img);
      setEditStatus(members[activeMemberId].status);
    }
  }, [activeMemberId, members]);

  const handleSelectMember = (id) => {
    setActiveMemberId(id);
    localStorage.setItem('my_member_id', id);
  };

  const handleSelectCharacter = (char) => {
    setEditName(char.name);
    setEditEmoji(char.emoji);
    setEditImg(char.img);
    setEditStatus(char.status);
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    const updated = {
      ...members,
      [activeMemberId]: {
        ...members[activeMemberId],
        name: editName,
        emoji: editEmoji,
        img: editImg,
        status: editStatus,
      }
    };
    setMembers(updated);
    setDoc(TRIP_DOC_REF, { members: updated }, { merge: true });
    setShowProfileModal(false);
  };

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      if (u) {
        onSnapshot(TRIP_DOC_REF, (snap) => {
          if (snap.exists() && snap.data().members) {
            setMembers(snap.data().members);
          } else {
            setDoc(TRIP_DOC_REF, { members: INITIAL_MEMBERS }, { merge: true });
          }
        });
      }
    });

    navigator.geolocation.getCurrentPosition(
      (pos) => updateMyLocation(pos.coords.latitude, pos.coords.longitude),
      (err) => console.log('위치 대기 중'),
      { enableHighAccuracy: true, timeout: 5000 }
    );

    return () => unsubAuth();
  }, [activeMemberId]);

  const updateMyLocation = (lat, lng) => {
    setMembers((prev) => {
      const updated = {
        ...prev,
        [activeMemberId]: {
          ...prev[activeMemberId],
          lat,
          lng,
        }
      };
      setDoc(TRIP_DOC_REF, { members: updated }, { merge: true });
      return updated;
    });
    setBgLog(`위치 동기화 완료 [${new Date().toLocaleTimeString()}]`);
  };

  const forceCurrentLocation = () => {
    setBgLog('현재 위치 수신 중...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateMyLocation(pos.coords.latitude, pos.coords.longitude);
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
      },
      (err) => setBgLog(`GPS 실패: ${err.message}`),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const toggleBackgroundTracking = async () => {
    if (isBgTracking) {
      if (watcherIdRef.current) {
        await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
      }
      setIsBgTracking(false);
      setBgLog('위치 추적 중지됨');
      return;
    }

    try {
      setBgLog('백그라운드 GPS 가동 중...');
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: "TOKYO 2026 TRACKER",
          backgroundMessage: `${activeMember.name} 위치 공유 중`,
          requestPermissions: true,
          stale: false,
          distanceFilter: 10
        },
        (location, error) => {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") {
              if (window.confirm("위치 권한을 '항상 허용'으로 설정해주세요.")) {
                BackgroundGeolocation.openSettings();
              }
            }
            setBgLog(`GPS 에러: ${error.message}`);
            return;
          }
          if (location) {
            updateMyLocation(location.latitude, location.longitude);
          }
        }
      );
      watcherIdRef.current = id;
      setIsBgTracking(true);
    } catch (e) {
      forceCurrentLocation();
      setIsBgTracking(true);
    }
  };

  useEffect(() => {
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }
    if (!window.L) {
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = initMap;
      document.body.appendChild(script);
    } else {
      initMap();
    }
  }, []);

  const initMap = () => {
    if (mapRef.current || !window.L) return;
    const L = window.L;
    mapRef.current = L.map('map-container', { zoomControl: false }).setView([35.6938, 139.7034], 14);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapRef.current);
  };

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    
    Object.values(members).forEach((m) => {
      const avatarImg = m.img || 'https://api.iconify.design/noto:crown.svg';
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;font-family:monospace;">
          <div style="background:#090d16;color:#fbbf24;border:1px solid #fbbf24;padding:3px 8px;font-size:10px;font-weight:bold;white-space:nowrap;box-shadow:0 0 10px rgba(251,191,36,0.4);letter-spacing:1px;display:flex;align-items:center;gap:4px;">
            <img src="${avatarImg}" style="width:14px;height:14px;object-fit:contain;" />
            <span>[${m.name}] ${m.status}</span>
          </div>
          <div style="width:14px;height:14px;background:#fbbf24;transform:rotate(45deg);border:2px solid #fff;margin-top:2px;box-shadow:0 0 10px #fbbf24;"></div>
        </div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [140, 48], iconAnchor: [70, 42] });
      
      if (markersRef.current[m.id]) {
        markersRef.current[m.id].setLatLng([m.lat, m.lng]).setIcon(icon);
      } else {
        markersRef.current[m.id] = L.marker([m.lat, m.lng], { icon }).addTo(mapRef.current);
      }
    });
  }, [members]);

  return (
    <div className="flex flex-col h-screen bg-[#07090e] text-slate-100 font-sans select-none overflow-hidden">
      
      {/* 상단 헤더 */}
      <header className="px-3 py-2.5 bg-[#0d121f] border-b border-amber-500/30 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 bg-amber-400 rotate-45 animate-pulse shadow-[0_0_8px_#fbbf24]"></div>
          <div>
            <h1 className="font-extrabold text-xs tracking-widest text-amber-400 uppercase">TOKYO 2026 3박4일</h1>
            <p className="text-[9px] text-slate-400 font-mono truncate max-w-[130px]">{bgLog}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={forceCurrentLocation}
            className="p-1.5 bg-[#151c2e] text-amber-400 rounded border border-amber-500/40"
            title="위치 새로고침"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => setShowProfileModal(true)}
            className="px-2 py-1 bg-[#151c2e] text-amber-300 rounded text-[11px] font-bold border border-amber-500/40 flex items-center gap-1"
          >
            <Settings className="w-3 h-3 text-amber-400" />
            설정
          </button>

          <button
            onClick={toggleBackgroundTracking}
            className={`px-2.5 py-1 rounded text-[11px] font-extrabold flex items-center gap-1 transition ${
              isBgTracking ? 'bg-amber-500 text-slate-950 shadow-[0_0_10px_rgba(251,191,36,0.6)] animate-pulse' : 'bg-[#1b2438] text-slate-300 border border-slate-700'
            }`}
          >
            <Zap className="w-3 h-3" />
            {isBgTracking ? '추적중' : '대기'}
          </button>
        </div>
      </header>

      {/* 4인 멤버 선택 바 (SD 아바타 적용) */}
      <div className="grid grid-cols-4 gap-1 p-1.5 bg-[#0a0e17] border-b border-amber-500/20">
        {Object.values(members).map((m) => {
          const isMe = activeMemberId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleSelectMember(m.id)}
              className={`p-1.5 text-left transition-all border relative overflow-hidden ${
                isMe 
                  ? 'bg-[#161f33] border-amber-400/80 shadow-[inset_0_0_8px_rgba(251,191,36,0.2)]' 
                  : 'bg-[#0d121f]/70 border-slate-800 opacity-70 hover:opacity-100'
              }`}
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 5px), calc(100% - 5px) 100%, 0 100%)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold text-slate-200 truncate flex items-center gap-1">
                  <img src={m.img || 'https://api.iconify.design/noto:crown.svg'} className="w-3.5 h-3.5 object-contain" />
                  {m.name}
                </span>
                {isMe && <span className="text-[7px] bg-amber-400 text-slate-950 px-0.5 font-mono font-bold">나</span>}
              </div>
              <div className="text-[8px] text-amber-300/80 truncate mt-0.5 font-mono">{m.status}</div>
            </button>
          );
        })}
      </div>

      {/* 지도 영역 */}
      <div id="map-container" className="flex-1 w-full bg-[#07090e]" />

      {/* 프로필 설정 모달 (SD 아바타 선택 그리드 적용) */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-50 p-3">
          <div className="bg-[#0d121f] border border-amber-500/50 w-full max-w-sm p-4 shadow-2xl max-h-[90vh] overflow-y-auto"
               style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%)' }}>
            <div className="flex items-center justify-between mb-3 border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4 text-amber-400" />
                <h2 className="text-xs font-extrabold text-amber-400 tracking-widest uppercase">공명자 SD 조율</h2>
              </div>
              <button onClick={() => setShowProfileModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">대상 멤버 선택</label>
                <div className="grid grid-cols-4 gap-1">
                  {Object.values(members).map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleSelectMember(m.id)}
                      className={`py-1 text-[10px] font-bold border flex items-center justify-center gap-1 ${
                        activeMemberId === m.id ? 'bg-amber-400 text-slate-950 border-amber-300' : 'bg-[#151c2e] text-slate-300 border-slate-700'
                      }`}
                    >
                      <img src={m.img} className="w-3 h-3 object-contain" />
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-amber-400/90 mb-1">⚡ 명조 SD 캐릭터 10종 선택 (터치하면 아바타 적용)</label>
                <div className="grid grid-cols-5 gap-1.5 bg-[#07090e] p-2 border border-amber-500/30 rounded">
                  {WUTHERING_CHARACTERS.map((char, idx) => (
                    <button
                      type="button"
                      key={idx}
                      onClick={() => handleSelectCharacter(char)}
                      className="p-1.5 bg-[#151c2e] hover:bg-amber-400/20 border border-slate-700 hover:border-amber-400 text-center transition flex flex-col items-center justify-center gap-1"
                    >
                      <img src={char.img} className="w-6 h-6 object-contain" />
                      <span className="text-[9px] text-slate-300 truncate w-full">{char.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">코드네임 (이름)</label>
                <input 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-[#07090e] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 mb-1">상태 메시지</label>
                <input 
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  placeholder="예: 아키하바라 탐색 중 ⚡" 
                  className="w-full bg-[#07090e] border border-slate-700 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 font-mono"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded py-2 text-xs font-bold transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded py-2 text-xs font-extrabold transition shadow-lg"
                >
                  조율 저장
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
