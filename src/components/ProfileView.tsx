import React, { useState } from 'react';
import { 
  User, 
  Phone, 
  IdCard, 
  Calendar, 
  Mail, 
  LogOut, 
  Save,
  Edit2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface ProfileViewProps {
  isDarkMode: boolean;
  profile: UserProfile;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

export const ProfileView = ({ isDarkMode, profile, onUpdate }: ProfileViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!auth.currentUser) return;
    setLoading(true);
    try {
      const userRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userRef, {
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
        idNumber: formData.idNumber,
        birthDate: formData.birthDate
      });
      onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error("Error updating profile:", error);
      alert("Error al actualizar el perfil");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-center py-6">
        <div className="relative">
          <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#B8860B] shadow-xl">
            <img 
              src="https://picsum.photos/seed/vendor/400/400" 
              alt="Profile" 
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <button className="absolute bottom-0 right-0 p-2 bg-[#B8860B] text-black rounded-full shadow-lg">
            <Edit2 className="w-4 h-4" />
          </button>
        </div>
        <h2 className="mt-4 text-2xl font-bold font-['Plus_Jakarta_Sans']">
          {profile.firstName} {profile.lastName}
        </h2>
        <p className={cn(
          "text-sm opacity-60",
          isDarkMode ? "text-[#FDFBF0]" : "text-[#2e2f2d]"
        )}>Vendedor Informal Verificado</p>
      </div>

      <div className={cn(
        "rounded-2xl p-6 space-y-6 transition-colors duration-500",
        isDarkMode ? "bg-[#1A1A1A]" : "bg-white shadow-sm"
      )}>
        <div className="space-y-4">
          <ProfileField 
            icon={<User />} 
            label="Nombres" 
            value={formData.firstName} 
            isEditing={isEditing}
            onChange={(v) => setFormData({...formData, firstName: v})}
            isDarkMode={isDarkMode}
          />
          <ProfileField 
            icon={<User />} 
            label="Apellidos" 
            value={formData.lastName} 
            isEditing={isEditing}
            onChange={(v) => setFormData({...formData, lastName: v})}
            isDarkMode={isDarkMode}
          />
          <ProfileField 
            icon={<IdCard />} 
            label="Identificación" 
            value={formData.idNumber} 
            isEditing={isEditing}
            onChange={(v) => setFormData({...formData, idNumber: v})}
            isDarkMode={isDarkMode}
          />
          <ProfileField 
            icon={<Phone />} 
            label="Teléfono" 
            value={formData.phone} 
            isEditing={isEditing}
            onChange={(v) => setFormData({...formData, phone: v})}
            isDarkMode={isDarkMode}
          />
          <ProfileField 
            icon={<Calendar />} 
            label="Fecha de Nacimiento" 
            value={formData.birthDate} 
            isEditing={isEditing}
            type="date"
            onChange={(v) => setFormData({...formData, birthDate: v})}
            isDarkMode={isDarkMode}
          />
          <ProfileField 
            icon={<Mail />} 
            label="Correo" 
            value={profile.email || 'No vinculado'} 
            isEditing={false}
            isDarkMode={isDarkMode}
          />
        </div>

        <div className="pt-4 flex flex-col gap-3">
          {isEditing ? (
            <button 
              onClick={handleSave}
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-black rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? "Guardando..." : "Guardar Cambios"}
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className={cn(
                "w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all active:scale-95",
                isDarkMode ? "border-[#B8860B] text-[#B8860B] hover:bg-[#B8860B]/10" : "border-[#B8860B] text-[#B8860B] hover:bg-[#B8860B]/5"
              )}
            >
              <Edit2 className="w-5 h-5" />
              Editar Perfil
            </button>
          )}

          <button 
            onClick={handleLogout}
            className="w-full h-14 flex items-center justify-center gap-2 text-red-500 font-bold hover:bg-red-500/10 rounded-xl transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </div>
  );
};

const ProfileField = ({ 
  icon, 
  label, 
  value, 
  isEditing, 
  onChange, 
  type = "text",
  isDarkMode
}: { 
  icon: React.ReactNode, 
  label: string, 
  value: string, 
  isEditing: boolean,
  onChange?: (v: string) => void,
  type?: string,
  isDarkMode: boolean
}) => (
  <div className="flex items-center gap-4">
    <div className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
      isDarkMode ? "bg-[#2A2A2A] text-[#B8860B]" : "bg-[#f1f1ee] text-[#B8860B]"
    )}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
    </div>
    <div className="flex-1">
      <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">{label}</p>
      {isEditing && onChange ? (
        <input 
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            "w-full bg-transparent border-b border-[#B8860B] focus:outline-none py-1 font-medium",
            isDarkMode ? "text-[#FDFBF0]" : "text-[#2e2f2d]"
          )}
        />
      ) : (
        <p className="font-bold text-lg">{value}</p>
      )}
    </div>
  </div>
);
