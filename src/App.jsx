import React, { useState, useEffect, useRef } from 'react';
import { registerPlugin } from '@capacitor/core';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { Radio, Users, MapPin, Compass, ShieldAlert, UserCheck, Settings } from 'lucide-react';

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

// 요청하신 4인 멤버 고정 세팅
const INITIAL_MEMBERS = {
  m1: { id: 'm1', name: '김현일', emoji: '😎', color: '#3b82f6', lat: 35.6938, lng: 139.7034, status: '이동 중 🏃', updatedAt: Date.now() },
  m2: { id: 'm2', name: '손민호', emoji: '🍺', color: '#10b981', lat: 35.6984, lng: 139.7731, status: '자유시간 🛍️', updatedAt: Date.now() },
  m3: { id: 'm3', name: '김현태', emoji: '🍣', color: '#f59e0b', lat: 35.6580, lng: 139.7016, status: '식사 중 🍜', updatedAt: Date.now() },
  m4: { id: 'm4', name: '김세진', emoji: '🎮', color: '#ec4899', lat: 35.7148, lng: 139.7967, status: '대기 중 ☕', updatedAt: Date.now() },
};

export default function App() {
  const [user, setUser] = useState(null);
  const [activeMemberId, setActiveMemberId] = useState(() => localStorage.getItem('my_member_id') || 'm1');
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [isBgTracking, setIsBgTracking] = useState(false);
  const [bgLog, setBgLog] = useState('대기 중 (백그라운드 GPS)');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const watcherIdRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  // 사용자 프로필 변경용 로컬 상태
  const activeMember = members[activeMemberId] || members.m1;

  const handleSelectMember = (id) => {
    setActiveMemberId(id);
    localStorage.setItem('my_member_id', id);
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    const newName = e.target.name.value;
    const newEmoji = e.target.emoji.value;
    const newStatus = e.target.status.value;

    const updated = {
      ...members,
      [activeMemberId]: {
        ...activeMember,
        name: newName,
        emoji: newEmoji,
        status: newStatus,
        updatedAt: Date.now()
      }
    };
    setMembers(updated);
    setDoc(TRIP_DOC_REF, { members: updated }, { merge: true });
    setShowProfileModal(false);
  };

  useEffect(() => {
    signInAnonymously(auth).catch(console.error);
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
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
    return () => unsubAuth();
  }, []);

  const updateMyLocationToCloud = async (lat, lng) => {
    try {
      const updated = {
        ...members,
        [activeMemberId]: {
          ...members[activeMemberId],
          lat,
          lng,
          updatedAt: Date.now()
        }
      };
      setMembers(updated);
      await setDoc(TRIP_DOC_REF, { members: updated }, { merge: true });
      setBgLog(`위치 전송 완료: ${new Date().toLocaleTimeString()}`);
    } catch (err) {
      setBgLog(`전송 오류: ${err.message}`);
    }
  };

  const toggleBackgroundTracking = async () => {
    if (isBgTracking) {
      if (watcherIdRef.current) {
        await BackgroundGeolocation.removeWatcher({ id: watcherIdRef.current });
        watcherIdRef.current = null;
      }
      setIsBgTracking(false);
      setBgLog('백그라운드 중지됨');
      return;
    }

    try {
      setBgLog('백그라운드 GPS 시작 중...');
      const id = await BackgroundGeolocation.addWatcher(
        {
          backgroundTitle: "🗼 도쿄 4인 실시간 위치 공유",
          backgroundMessage: `${activeMember.name}님의 위치를 동기화 중입니다.`,
          requestPermissions: true,
          stale: false,
          distanceFilter: 15
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
            updateMyLocationToCloud(location.latitude, location.longitude);
          }
        }
      );
      watcherIdRef.current = id;
      setIsBgTracking(true);
    } catch (e) {
      setBgLog('웹 모드 GPS 작동 중');
      navigator.geolocation.watchPosition(
        (pos) => updateMyLocationToCloud(pos.coords.latitude, pos.coords.longitude),
        (err) => setBgLog(`웹 GPS 오류: ${err.message}`),
        { enableHighAccuracy: true }
      );
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
    mapRef.current = L.map('map-container').setView([35.6938, 139.7034], 13);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '© OpenStreetMap'
    }).addTo(mapRef.current);
  };

  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;
    Object.values(members).forEach((m) => {
      const html = `
        <div style="display:flex;flex-direction:column;align-items:center;">
          <div style="background:${m.color};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:bold;white-space:nowrap;box-shadow:0 2px 6px rgba(0,0,0,0.4);">
            ${m.emoji} ${m.name} (${m.status})
          </div>
          <div style="width:16px;height:16px;border-radius:50%;background:${m.color};border:2px solid #fff;margin-top:2px;box-shadow:0 2px 4px rgba(0,0,0,0.5);"></div>
        </div>`;
      const icon = L.divIcon({ html, className: '', iconSize: [100, 45], iconAnchor: [50, 40] });
      if (markersRef.current[m.id]) {
        markersRef.current[m.id].setLatLng([m.lat, m.lng]).setIcon(icon);
      } else {
        markersRef.current[m.id] = L.marker([m.lat, m.lng], { icon }).addTo(mapRef.current);
      }
    });
  }, [members]);

  return (
    <div className="flex flex-col h-screen bg-[#0f172a] text-slate-100 font-sans select-none">
      
      {/* 명조 스타일 상단 헤더 (다크네이비/골드 포인트) */}
      <header className="px-4 py-3 bg-[#1e293b] border-b border-[#334155] flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-amber-500 animate-ping"></div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide text-amber-400">TOKYO 2026 3박4일</h1>
            <p className="text-[10px] text-slate-400">{bgLog}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfileModal(true)}
            className="px-2.5 py-1.5 bg-[#334155] hover:bg-[#475569] text-amber-300 rounded-lg text-xs font-bold border border-amber-500/30 flex items-center gap-1 transition"
          >
            <Settings className="w-3.5 h-3.5" />
            프로필 설정
          </button>

          <button
            onClick={toggleBackgroundTracking}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 shadow-lg transition ${
              isBgTracking ? 'bg-emerald-600 hover:bg-emerald-500 text-white animate-pulse' : 'bg-rose-600 hover:bg-rose-500 text-white'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            {isBgTracking ? '추적중' : '추적시작'}
          </button>
        </div>
      </header>

      {/* 명조 스타일 4인 멤버 카드 바 (내 캐릭터 선택 및 상태 표시) */}
      <div className="grid grid-cols-4 gap-1.5 p-2 bg-[#1e293b]/80 border-b border-[#334155]">
        {Object.values(members).map((m) => {
          const isMe = activeMemberId === m.id;
          return (
            <button
              key={m.id}
              onClick={() => handleSelectMember(m.id)}
              className={`p-2 rounded-xl text-left border transition-all ${
                isMe 
                  ? 'bg-[#334155] border-amber-500/80 shadow-inner' 
                  : 'bg-[#1e293b] border-slate-700/60 opacity-80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-slate-200">{m.emoji} {m.name}</span>
                {isMe && <span className="text-[9px] bg-amber-500 text-slate-950 px-1 rounded font-bold">나</span>}
              </div>
              <div className="text-[10px] text-amber-300/90 truncate mt-0.5">{m.status}</div>
            </button>
          );
        })}
      </div>

      {/* 지도 영역 */}
      <div id="map-container" className="flex-1 w-full bg-[#090d16]" />

      {/* 프로필 설정 모달 */}
      {showProfileModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#1e293b] border border-amber-500/40 rounded-2xl w-full max-w-sm p-5 shadow-2xl">
            <h2 className="text-base font-extrabold text-amber-400 mb-1">내 프로필 및 상태 설정</h2>
            <p className="text-xs text-slate-400 mb-4">현재 기기에서 조종할 내 캐릭터와 상태를 변경합니다.</p>

            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">참여자 선택 (내 번호)</label>
                <div className="grid grid-cols-4 gap-1">
                  {Object.values(members).map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      onClick={() => handleSelectMember(m.id)}
                      className={`py-1.5 text-xs rounded-lg font-bold border ${
                        activeMemberId === m.id ? 'bg-amber-500 text-slate-950 border-amber-400' : 'bg-[#0f172a] text-slate-300 border-slate-700'
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">이름</label>
                <input 
                  name="name" 
                  defaultValue={activeMember.name} 
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">프로필 이모지</label>
                <input 
                  name="emoji" 
                  defaultValue={activeMember.emoji} 
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">현재 상태 메시지</label>
                <input 
                  name="status" 
                  defaultValue={activeMember.status} 
                  placeholder="예: 아키하바라 쇼핑 중 🛍️" 
                  className="w-full bg-[#0f172a] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowProfileModal(false)}
                  className="flex-1 bg-slate-700 hover:bg-slate-600 text-white rounded-xl py-2.5 text-xs font-bold transition"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl py-2.5 text-xs font-bold transition shadow-lg"
                >
                  저장하기
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
