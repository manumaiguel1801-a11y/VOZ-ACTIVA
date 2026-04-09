import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from './firebase';
import { Tab, UserProfile } from './types';

// Components
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { FinanceView } from './components/FinanceView';
import { CameraView } from './components/CameraView';
import { InventorySalesView } from './components/InventorySalesView';
import { PassportView } from './components/PassportView';
import { ProfileView } from './components/ProfileView';
import { Auth } from './components/Auth';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('inicio');
  const [isDarkMode, setIsDarkMode] = useState<boolean>(false);

  const toggleDarkMode = () => setIsDarkMode(!isDarkMode);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data() as UserProfile);
      }
      setLoading(false);
    }, (error) => {
      console.error("Error fetching profile:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDFBF0]">
        <div className="w-16 h-16 border-4 border-[#B8860B] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Auth isDarkMode={isDarkMode} />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
      isDarkMode={isDarkMode}
      toggleDarkMode={toggleDarkMode}
      userName={profile ? `Hola, ${profile.firstName}` : 'Bienvenido'}
    >
      <AnimatePresence mode="wait">
        {activeTab === 'inicio' && (
          <motion.div key="dashboard" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <Dashboard isDarkMode={isDarkMode} />
          </motion.div>
        )}
        {activeTab === 'finanzas' && (
          <motion.div key="finanzas" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <FinanceView isDarkMode={isDarkMode} />
          </motion.div>
        )}
        {activeTab === 'camara' && (
          <motion.div key="camera" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <CameraView isDarkMode={isDarkMode} />
          </motion.div>
        )}
        {activeTab === 'inventario' && (
          <motion.div key="inventario" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <InventorySalesView isDarkMode={isDarkMode} />
          </motion.div>
        )}
        {activeTab === 'pasaporte' && (
          <motion.div key="passport" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <PassportView isDarkMode={isDarkMode} />
          </motion.div>
        )}
        {activeTab === 'perfil' && profile && (
          <motion.div key="profile" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <ProfileView 
              isDarkMode={isDarkMode} 
              profile={profile} 
              onUpdate={(updated) => setProfile({ ...profile, ...updated })} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  );
}
