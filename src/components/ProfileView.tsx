import React, { useState } from 'react';
import {
  User,
  Phone,
  IdCard,
  Calendar,
  Mail,
  LogOut,
  Save,
  Edit2,
  MessageSquare,
  ChevronRight,
  Send,
  CheckCircle2,
  Copy,
  Check,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import { auth, db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { SuggestionsModal } from './SuggestionsModal';

interface ProfileViewProps {
  isDarkMode: boolean;
  profile: UserProfile;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

export const ProfileView = ({ isDarkMode, profile, onUpdate }: ProfileViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateLinkCode = async () => {
    if (!auth.currentUser) return;
    setLinking(true);
    try {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { linkCode: { code, expiresAt } });
      setLinkCode(code);
    } catch (err) {
      console.error('Error generating link code:', err);
      alert('Error al generar el código. Intenta de nuevo.');
    } finally {
      setLinking(false);
    }
  };

  const copyCode = () => {
    if (!linkCode) return;
    navigator.clipboard.writeText(`/vincular ${linkCode}`).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

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
    <div className="space-y-6">
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

      {/* Telegram Linking — prominent feature banner */}
      {profile.telegramChatId ? (
        /* Compact linked badge */
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-2xl',
          isDarkMode ? 'bg-green-500/10' : 'bg-green-50'
        )}>
          <div className="w-8 h-8 rounded-xl bg-green-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-green-600">Telegram vinculado</p>
            <p className={cn('text-[10px] font-medium', isDarkMode ? 'text-white/40' : 'text-black/40')}>
              Ya puedes registrar movimientos desde Telegram
            </p>
          </div>
          <Send className="w-4 h-4 text-[#229ED9] flex-shrink-0" />
        </div>
      ) : linkCode ? (
        /* Code display — prominent */
        <div className={cn(
          'rounded-2xl p-5 border-2 border-[#229ED9]/30',
          isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm'
        )}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-2xl bg-[#229ED9] flex items-center justify-center flex-shrink-0">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="font-black text-sm">¡Casi listo!</p>
              <p className={cn('text-[11px] font-medium', isDarkMode ? 'text-white/50' : 'text-black/50')}>
                Envía este comando a <b>@VozActivaBot</b> en Telegram
              </p>
            </div>
          </div>
          <button
            onClick={copyCode}
            className={cn(
              'w-full flex items-center justify-between px-4 py-3 rounded-xl font-mono text-sm font-bold border-2 transition-all active:scale-95 mb-2',
              isDarkMode
                ? 'bg-[#0D0D0D] border-[#229ED9]/40 text-[#229ED9]'
                : 'bg-[#f1f8fd] border-[#229ED9]/30 text-[#229ED9]'
            )}
          >
            <span>/vincular {linkCode}</span>
            {copied
              ? <Check className="w-4 h-4 text-green-500" />
              : <Copy className="w-4 h-4 opacity-60" />}
          </button>
          <p className={cn('text-[10px] font-medium text-center', isDarkMode ? 'text-white/30' : 'text-black/30')}>
            Código válido 10 minutos · Toca para copiar
          </p>
        </div>
      ) : (
        /* Feature banner — unlinked state */
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-[#229ED9] to-[#1a7fb5] p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Send className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-base leading-tight">
                  Registra sin abrir la app
                </p>
                <p className="text-white/80 text-xs font-medium mt-1 leading-snug">
                  Escribe <i>"vendí 3 almuerzos a 12 mil"</i> en Telegram y lo registramos automáticamente.
                </p>
              </div>
            </div>
            <button
              onClick={generateLinkCode}
              disabled={linking}
              className="mt-4 w-full h-11 bg-white text-[#1a7fb5] rounded-xl font-black text-sm flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-60 shadow-md"
            >
              <Send className="w-4 h-4" />
              {linking ? 'Generando código...' : 'Vincular con Telegram'}
            </button>
          </div>
          <div className={cn(
            'px-5 py-3 flex items-center gap-2',
            isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#f1f8fd]'
          )}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#229ED9]" />
            <p className={cn('text-[10px] font-bold', isDarkMode ? 'text-white/40' : 'text-[#229ED9]/70')}>
              Gratis · Sin instalar nada extra · Funciona en Colombia
            </p>
          </div>
        </div>
      )}

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
            label="Correo de acceso"
            value={profile.email || `${profile.idNumber}@vozactiva.com`}
            isEditing={false}
            isDarkMode={isDarkMode}
            isGenerated={!profile.email}
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
      {/* PQRS / Contáctanos */}
      <button
        onClick={() => setShowSuggestions(true)}
        className={cn(
          'w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]',
          isDarkMode ? 'bg-[#1A1A1A] hover:bg-[#222]' : 'bg-white shadow-sm hover:shadow-md'
        )}
      >
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#B8860B] to-[#FFD700] flex items-center justify-center flex-shrink-0 shadow-md">
          <MessageSquare className="w-5 h-5 text-black" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-black text-sm">PQRS · Contáctanos</p>
          <p className={cn('text-[11px] font-medium', isDarkMode ? 'text-white/40' : 'text-black/40')}>
            Sugerencias, felicitaciones, quejas o reclamos
          </p>
        </div>
        <ChevronRight className={cn('w-4 h-4 flex-shrink-0', isDarkMode ? 'text-white/20' : 'text-black/20')} />
      </button>

      {showSuggestions && (
        <SuggestionsModal
          isDarkMode={isDarkMode}
          fromName={`${profile.firstName} ${profile.lastName}`.trim()}
          onClose={() => setShowSuggestions(false)}
        />
      )}
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
  isDarkMode,
  isGenerated = false,
}: {
  icon: React.ReactNode,
  label: string,
  value: string,
  isEditing: boolean,
  onChange?: (v: string) => void,
  type?: string,
  isDarkMode: boolean,
  isGenerated?: boolean,
}) => (
  <div className="flex items-start gap-4">
    <div className={cn(
      "w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 mt-0.5",
      isDarkMode ? "bg-[#2A2A2A] text-[#B8860B]" : "bg-[#f1f1ee] text-[#B8860B]"
    )}>
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
    </div>
    <div className="flex-1 min-w-0">
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
        <>
          <p className={cn("font-bold text-lg break-all", isGenerated ? "text-[#B8860B]" : "")}>{value}</p>
          {isGenerated && (
            <p className={cn("text-[10px] font-bold mt-0.5", isDarkMode ? "text-white/30" : "text-black/30")}>
              Generado automáticamente con tu cédula
            </p>
          )}
        </>
      )}
    </div>
  </div>
);
