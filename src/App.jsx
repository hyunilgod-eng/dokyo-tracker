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

const WUTHERING_CHARACTERS = [
  { name: '금희', emoji: '👑', status: '금장 공명자 ⚡' },
  { name: '음림', emoji: '🦊', status: '잔향 주파수 스캔 🔍' },
  { name: '장리', emoji: '🔥', status: '홍련의 심판 대기 🌸' },
  { name: '금장', emoji: '⚔️', status: '전술 지휘 중 🎯' },
  { name: '카카루', emoji: '⚡', status: '뇌전뢰격 모드 ⚡' },
  { name: '엔코', emoji: '🐾', status: '간식 탐색 중 🍎' },
  { name: '양양', emoji: '🍃', status: '바람의 인도 🍃' },
  { name: '치샤', emoji: '🔫', status: '권총 사격 훈련 🎯' },
  { name: '도기', emoji: '🛡️', status: '방어선 구축 🛡️' },
  { name: '방랑자', emoji: '✨', status: '차원 경계 탐색 🌀' },
];

const INITIAL_MEMBERS = {
  m1: { id: 'm1', name: '김현일', emoji: '👑', lat: 35.6938, lng: 139.7034, status: '금장 공명자 ⚡' },
  m2: { id: 'm2', name: '손민호', emoji: '🦊', lat: 35.6984, lng: 139.7731, status: '잔향 주파수 스캔 🔍' },
  m3: { id: 'm3', name: '김현태', emoji: '🔥', lat: 35.6580, lng: 139.7016, status: '홍련의 심판 대기 🌸' },
  m4: { id: 'm4', name: '김세진', emoji: '⚔️', lat: 35.7148, lng: 139.7967, status: '전술 지휘 중 🎯' },
};

export default function App() {
  const [myMemberId] = useState(() => localStorage.getItem('my_member_id') || 'm1');
  const [members, setMembers] = useState(INITIAL_MEMBERS);
  const [isBgTracking, setIsBgTracking] = useState(false);
  const [bgLog, setBgLog] = useState('1분 주기 자동 동기화 대기 중...');
  const [showProfileModal, setShowProfileModal] = useState(false);
  
  const [editTargetId, setEditTargetId] = useState('m1');
  const [editName, setEditName] = useState('');
  const [editEmoji, setEditEmoji] = useState('');
  const [editStatus, setEditStatus] = useState('');

  const watcherIdRef = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef({});

  useEffect(() => {
    if (members[editTargetId]) {
      setEditName(members[editTargetId].name);
      setEditEmoji(members[editTargetId].emoji);
      setEditStatus(members[editTargetId].status);
    }
  }, [editTargetId, members]);

  const handleFocusMember = (m) => {
    if (mapRef.current && m.lat && m.lng) {
      mapRef.current.setView([m.lat, m.lng], 15);
    }
  };

  const handleSelectCharacter = (char) => {
    setEditName(char.name);
    setEditEmoji(char.emoji);
    setEditStatus(char.status);
  };

  const handleUpdateProfile = (e) => {
    e.preventDefault();
    const updated = {
      ...members,
      [editTargetId]: {
        ...members[editTargetId],
        name: editName,
        emoji: editEmoji,
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
      (pos) => updateMyGPS(pos.coords.latitude, pos.coords.longitude),
      (err) => console.log('초기 GPS 대기'),
      { enableHighAccuracy: true }
    );

    const autoSyncInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          updateMyGPS(pos.coords.latitude, pos.coords.longitude);
          setBgLog(`1분 자동 동기화 완료 [${new Date().toLocaleTimeString()}]`);
        },
        (err) => setBgLog(`자동 동기화 대기 중...`),
        { enableHighAccuracy: true }
      );
    }, 60000);

    return () => {
      unsubAuth();
      clearInterval(autoSyncInterval);
    };
  }, [myMemberId]);

  const updateMyGPS = (lat, lng) => {
    setMembers((prev) => {
      const updated = {
        ...prev,
        [myMemberId]: {
          ...prev[myMemberId],
          lat,
          lng,
        }
      };
      setDoc(TRIP_DOC_REF, { members: updated }, { merge: true });
      return updated;
    });
  };

  const forceCurrentLocation = () => {
    setBgLog('현재 위치 수신 중...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        updateMyGPS(pos.coords.latitude, pos.coords.longitude);
        if (mapRef.current) {
          mapRef.current.setView([pos.coords.latitude, pos.coords.longitude], 15);
        }
        setBgLog(`위치 새로고침 완료 [${new Date().toLocaleTimeString()}]`);
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
          backgroundMessage: "실시간 위치 동기화 활성화됨",
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
            updateMyGPS(location.latitude, location.longitude);
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

  // 겹침 방지 오프셋 계산 로직 포함 마커 렌더링
  useEffect(() => {
    if (!mapRef.current || !window.L) return;
    const L = window.L;

    const memberList = Object.values(members);
    
    // 동일 위치 밀집 시 분산 배치를 위한 오프셋 계산
    memberList.forEach((m, index) => {
      let lat = m.lat;
      let lng = m.lng;

      // 다른 멤버들과 좌표가 매우 가까울 경우 방사형으로 살짝 밀어줌 (겹침 방지)
      memberList.forEach((other, oIndex) => {
        if (index !== oIndex) {
          const dist = Math.abs(m.lat - other.lat) + Math.abs(m.lng - other.lng);
          if (dist < 0.0001) {
            const angle = (index / memberList.length) * (2 * Math.PI);
            lat += Math.sin(angle) * 0.00015;
            lng += Math.cos(angle) * 0.000
