import React, { useState, useRef } from 'react';
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
  Camera,
  ImagePlus,
  X,
  Loader2,
} from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { cn } from '../lib/utils';
import { UserProfile } from '../types';
import { auth, db, storage } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { SuggestionsModal } from './SuggestionsModal';

interface ProfileViewProps {
  isDarkMode: boolean;
  profile: UserProfile;
  onUpdate: (updated: Partial<UserProfile>) => void;
}

// ─── Avatar: foto o iniciales ─────────────────────────────────────────────────

const Avatar = ({
  photoURL,
  firstName,
  lastName,
  size = 'lg',
  isDarkMode,
}: {
  photoURL?: string;
  firstName: string;
  lastName: string;
  size?: 'lg' | 'sm';
  isDarkMode: boolean;
}) => {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const sizeClasses = size === 'lg' ? 'w-32 h-32 text-4xl' : 'w-10 h-10 text-sm';

  if (photoURL) {
    return (
      <img
        src={photoURL}
        alt="Perfil"
        referrerPolicy="no-referrer"
        className={cn('rounded-full object-cover', sizeClasses)}
      />
    );
  }
  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center font-black select-none',
        'bg-gradient-to-br from-[#B8860B] to-[#DAA520]',
        isDarkMode ? 'text-[#0D0D0D]' : 'text-[#1A1A1A]',
        sizeClasses,
      )}
    >
      {initials || <User className={size === 'lg' ? 'w-12 h-12' : 'w-5 h-5'} />}
    </div>
  );
};

export { Avatar };

// ─── ProfileView ──────────────────────────────────────────────────────────────

export const ProfileView = ({ isDarkMode, profile, onUpdate }: ProfileViewProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState(profile);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [copied, setCopied] = useState(false);

  // Photo states
  const [showPhotoOptions, setShowPhotoOptions] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoToast, setPhotoToast] = useState<string | null>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setPhotoToast(msg);
    setTimeout(() => setPhotoToast(null), 3000);
  };

  const handlePhotoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setShowPhotoOptions(false);
    e.target.value = '';
  };

  const handleConfirmPhoto = async () => {
    if (!previewFile || !auth.currentUser) return;
    setUploadingPhoto(true);
    try {
      const storageRef = ref(storage, `users/${auth.currentUser.uid}/profile.jpg`);
      await uploadBytes(storageRef, previewFile, { contentType: previewFile.type });
      const downloadUrl = await getDownloadURL(storageRef);
      await updateDoc(doc(db, 'users', auth.currentUser.uid), { photoURL: downloadUrl });
      onUpdate({ photoURL: downloadUrl });
      setPreviewUrl(null);
      setPreviewFile(null);
      showToast('¡Foto actualizada!');
    } catch (err: any) {
      console.error('Error subiendo foto:', err?.code, err?.message, err);
      const msg = err?.code === 'storage/unauthorized'
        ? 'Sin permiso. Despliega las reglas de Storage.'
        : `Error: ${err?.code ?? err?.message ?? 'desconocido'}`;
      showToast(msg);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleCancelPhoto = () => {
    setPreviewUrl(null);
    setPreviewFile(null);
  };

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
        birthDate: formData.birthDate,
      });
      onUpdate(formData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error al actualizar el perfil');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="space-y-6">
      {/* Hidden file inputs */}
      {/* @ts-ignore — capture="user" is valid HTML */}
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="user"
        onChange={handlePhotoFileSelected}
        className="hidden"
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFileSelected}
        className="hidden"
      />

      {/* Avatar section */}
      <div className="flex flex-col items-center py-6">
        <button
          onClick={() => setShowPhotoOptions(true)}
          className="relative group"
          aria-label="Cambiar foto de perfil"
        >
          <div className="rounded-full overflow-hidden border-4 border-[#B8860B] shadow-xl w-32 h-32">
            <Avatar
              photoURL={profile.photoURL}
              firstName={profile.firstName}
              lastName={profile.lastName}
              size="lg"
              isDarkMode={isDarkMode}
            />
          </div>
          {/* Camera badge */}
          <div className="absolute bottom-0 right-0 w-9 h-9 rounded-full bg-[#B8860B] flex items-center justify-center shadow-lg border-2 border-[#FDFBF0] group-active:scale-90 transition-transform">
            <Camera className="w-4 h-4 text-black" />
          </div>
        </button>
        <h2 className="mt-4 text-2xl font-bold font-['Plus_Jakarta_Sans']">
          {profile.firstName} {profile.lastName}
        </h2>
        <p className={cn('text-sm opacity-60', isDarkMode ? 'text-[#FDFBF0]' : 'text-[#2e2f2d]')}>
          Vendedor Informal Verificado
        </p>
      </div>

      {/* Telegram Linking */}
      {profile.telegramChatId ? (
        <div className={cn('flex items-center gap-3 px-4 py-3 rounded-2xl', isDarkMode ? 'bg-green-500/10' : 'bg-green-50')}>
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
        <div className={cn('rounded-2xl p-5 border-2 border-[#229ED9]/30', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
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
              isDarkMode ? 'bg-[#0D0D0D] border-[#229ED9]/40 text-[#229ED9]' : 'bg-[#f1f8fd] border-[#229ED9]/30 text-[#229ED9]',
            )}
          >
            <span>/vincular {linkCode}</span>
            {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4 opacity-60" />}
          </button>
          <p className={cn('text-[10px] font-medium text-center', isDarkMode ? 'text-white/30' : 'text-black/30')}>
            Código válido 10 minutos · Toca para copiar
          </p>
        </div>
      ) : (
        <div className="rounded-2xl overflow-hidden shadow-lg">
          <div className="bg-gradient-to-br from-[#229ED9] to-[#1a7fb5] p-5">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Send className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-black text-white text-base leading-tight">Registra sin abrir la app</p>
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
          <div className={cn('px-5 py-3 flex items-center gap-2', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-[#f1f8fd]')}>
            <div className="w-1.5 h-1.5 rounded-full bg-[#229ED9]" />
            <p className={cn('text-[10px] font-bold', isDarkMode ? 'text-white/40' : 'text-[#229ED9]/70')}>
              Gratis · Sin instalar nada extra · Funciona en Colombia
            </p>
          </div>
        </div>
      )}

      {/* Profile fields */}
      <div className={cn('rounded-2xl p-6 space-y-6 transition-colors duration-500', isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white shadow-sm')}>
        <div className="space-y-4">
          <ProfileField icon={<User />} label="Nombres" value={formData.firstName} isEditing={isEditing} onChange={(v) => setFormData({ ...formData, firstName: v })} isDarkMode={isDarkMode} />
          <ProfileField icon={<User />} label="Apellidos" value={formData.lastName} isEditing={isEditing} onChange={(v) => setFormData({ ...formData, lastName: v })} isDarkMode={isDarkMode} />
          <ProfileField icon={<IdCard />} label="Identificación" value={formData.idNumber} isEditing={isEditing} onChange={(v) => setFormData({ ...formData, idNumber: v })} isDarkMode={isDarkMode} />
          <ProfileField icon={<Phone />} label="Teléfono" value={formData.phone} isEditing={isEditing} onChange={(v) => setFormData({ ...formData, phone: v })} isDarkMode={isDarkMode} />
          <ProfileField icon={<Calendar />} label="Fecha de Nacimiento" value={formData.birthDate} isEditing={isEditing} type="date" onChange={(v) => setFormData({ ...formData, birthDate: v })} isDarkMode={isDarkMode} />
          <ProfileField icon={<Mail />} label="Correo de acceso" value={profile.email || `${profile.idNumber}@vozactiva.com`} isEditing={false} isDarkMode={isDarkMode} isGenerated={!profile.email} />
        </div>

        <div className="pt-4 flex flex-col gap-3">
          {isEditing ? (
            <button
              onClick={handleSave}
              disabled={loading}
              className="w-full h-14 bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-black rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className={cn(
                'w-full h-14 rounded-xl font-bold flex items-center justify-center gap-2 border-2 transition-all active:scale-95',
                isDarkMode ? 'border-[#B8860B] text-[#B8860B] hover:bg-[#B8860B]/10' : 'border-[#B8860B] text-[#B8860B] hover:bg-[#B8860B]/5',
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

      {/* PQRS */}
      <button
        onClick={() => setShowSuggestions(true)}
        className={cn(
          'w-full flex items-center gap-4 p-4 rounded-2xl transition-all active:scale-[0.98]',
          isDarkMode ? 'bg-[#1A1A1A] hover:bg-[#222]' : 'bg-white shadow-sm hover:shadow-md',
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

      {/* ── Photo options modal ──────────────────────────────────────────────── */}
      {showPhotoOptions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowPhotoOptions(false)}
          />
          {/* Modal */}
          <div className={cn(
            'relative w-full max-w-xs rounded-3xl p-6 space-y-3 animate-in zoom-in-95 duration-300',
            isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white',
          )}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-black text-[#B8860B] text-sm uppercase tracking-widest">Foto de perfil</p>
              <button
                onClick={() => setShowPhotoOptions(false)}
                className={cn('w-8 h-8 rounded-full flex items-center justify-center', isDarkMode ? 'bg-white/10' : 'bg-black/5')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => cameraInputRef.current?.click()}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]',
                isDarkMode ? 'bg-[#2A2A2A] hover:bg-[#333]' : 'bg-[#FDFBF0] hover:bg-[#f1f1ee]',
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B8860B] to-[#FFD700] flex items-center justify-center flex-shrink-0">
                <Camera className="w-5 h-5 text-black" />
              </div>
              <span>Tomar foto</span>
            </button>
            <button
              onClick={() => galleryInputRef.current?.click()}
              className={cn(
                'w-full flex items-center gap-4 p-4 rounded-2xl font-bold text-sm transition-all active:scale-[0.98]',
                isDarkMode ? 'bg-[#2A2A2A] hover:bg-[#333]' : 'bg-[#FDFBF0] hover:bg-[#f1f1ee]',
              )}
            >
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#B8860B] to-[#FFD700] flex items-center justify-center flex-shrink-0">
                <ImagePlus className="w-5 h-5 text-black" />
              </div>
              <span>Elegir de galería</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Preview modal ────────────────────────────────────────────────────── */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleCancelPhoto} />
          {/* Modal */}
          <div className={cn(
            'relative w-full max-w-xs rounded-3xl p-6 space-y-5 text-center animate-in zoom-in-95 duration-300',
            isDarkMode ? 'bg-[#1A1A1A]' : 'bg-white',
          )}>
            <p className="font-black text-[#B8860B] text-sm uppercase tracking-widest">Vista previa</p>

            {/* Circular preview */}
            <div className="flex justify-center">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-[#B8860B] shadow-xl">
                <img src={previewUrl} alt="Vista previa" className="w-full h-full object-cover" />
              </div>
            </div>

            <p className={cn('text-xs font-medium', isDarkMode ? 'text-white/40' : 'text-black/40')}>
              ¿Se ve bien? Confirma para guardar.
            </p>

            <div className="flex gap-3">
              <button
                onClick={handleCancelPhoto}
                disabled={uploadingPhoto}
                className={cn(
                  'flex-1 h-12 rounded-xl font-bold text-sm border-2 transition-all active:scale-95',
                  isDarkMode ? 'border-white/15 text-white/60' : 'border-black/15 text-black/60',
                )}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmPhoto}
                disabled={uploadingPhoto}
                className="flex-1 h-12 rounded-xl font-black text-sm bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-black shadow-lg flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {uploadingPhoto
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Subiendo...</>
                  : <><Check className="w-4 h-4" /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ────────────────────────────────────────────────────────────── */}
      {photoToast && (
        <div className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-300">
          <div className={cn(
            'flex items-center gap-2 px-5 py-3 rounded-2xl shadow-2xl font-black text-sm whitespace-nowrap',
            isDarkMode ? 'bg-[#1A1A1A] text-[#FFD700] border border-[#B8860B]/30' : 'bg-white text-[#B8860B] border border-[#DAA520]/20',
          )}>
            <CheckCircle2 className="w-4 h-4 text-green-500" />
            {photoToast}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── ProfileField ─────────────────────────────────────────────────────────────

const ProfileField = ({
  icon,
  label,
  value,
  isEditing,
  onChange,
  type = 'text',
  isDarkMode,
  isGenerated = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  isEditing: boolean;
  onChange?: (v: string) => void;
  type?: string;
  isDarkMode: boolean;
  isGenerated?: boolean;
}) => (
  <div className="flex items-start gap-4">
    <div className={cn(
      'w-10 h-10 rounded-full flex items-center justify-center transition-colors flex-shrink-0 mt-0.5',
      isDarkMode ? 'bg-[#2A2A2A] text-[#B8860B]' : 'bg-[#f1f1ee] text-[#B8860B]',
    )}>
      {React.cloneElement(icon as React.ReactElement, { className: 'w-5 h-5' })}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] uppercase tracking-widest opacity-50 font-bold">{label}</p>
      {isEditing && onChange ? (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'w-full bg-transparent border-b border-[#B8860B] focus:outline-none py-1 font-medium',
            isDarkMode ? 'text-[#FDFBF0]' : 'text-[#2e2f2d]',
          )}
        />
      ) : (
        <>
          <p className={cn('font-bold text-lg break-all', isGenerated ? 'text-[#B8860B]' : '')}>{value}</p>
          {isGenerated && (
            <p className={cn('text-[10px] font-bold mt-0.5', isDarkMode ? 'text-white/30' : 'text-black/30')}>
              Generado automáticamente con tu cédula
            </p>
          )}
        </>
      )}
    </div>
  </div>
);
