import React, { useState } from 'react';
import { 
  Mail, 
  Lock, 
  User, 
  Phone, 
  IdCard, 
  Calendar, 
  ArrowRight,
  ChevronLeft
} from 'lucide-react';
import { cn } from '../lib/utils';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

interface AuthProps {
  isDarkMode: boolean;
}

export const Auth = ({ isDarkMode }: AuthProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [isManual, setIsManual] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        // Registration
        let finalEmail = email;
        if (isManual) {
          finalEmail = `${idNumber}@vozactiva.com`;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, password);
        const user = userCredential.user;

        // Save profile to Firestore
        await setDoc(doc(db, 'users', user.uid), {
          firstName,
          lastName,
          idNumber,
          phone,
          birthDate,
          email: isManual ? null : email,
          createdAt: serverTimestamp()
        });
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Ocurrió un error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "min-h-screen flex flex-col px-6 py-12 transition-colors duration-500",
      isDarkMode ? "bg-[#0D0D0D] text-[#FDFBF0]" : "bg-[#FDFBF0] text-[#2e2f2d]"
    )}>
      <div className="max-w-md mx-auto w-full flex-1 flex flex-col">
        {/* Logo/Header */}
        <div className="mb-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#B8860B] to-[#FFD700] rounded-3xl mx-auto flex items-center justify-center shadow-xl mb-6 rotate-12">
            <IdCard className="w-10 h-10 text-black -rotate-12" />
          </div>
          <h1 className="text-4xl font-black font-['Plus_Jakarta_Sans'] text-[#B8860B] tracking-tight">
            Voz-Activa
          </h1>
          <p className="opacity-60 mt-2 font-medium">Inclusión financiera para todos</p>
        </div>

        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-5 flex-1">
          <h2 className="text-2xl font-bold mb-6">
            {isLogin ? 'Iniciar Sesión' : (isManual ? 'Registro Manual' : 'Crear Cuenta')}
          </h2>

          {!isLogin && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-2 gap-4">
                <Input 
                  icon={<User />} 
                  placeholder="Nombres" 
                  value={firstName} 
                  onChange={setFirstName} 
                  isDarkMode={isDarkMode}
                  required
                />
                <Input 
                  icon={<User />} 
                  placeholder="Apellidos" 
                  value={lastName} 
                  onChange={setLastName} 
                  isDarkMode={isDarkMode}
                  required
                />
              </div>
              <Input 
                icon={<IdCard />} 
                placeholder="Número de Identificación" 
                value={idNumber} 
                onChange={setIdNumber} 
                isDarkMode={isDarkMode}
                required
              />
              <Input 
                icon={<Phone />} 
                placeholder="Teléfono" 
                value={phone} 
                onChange={setPhone} 
                isDarkMode={isDarkMode}
                required
              />
              <Input 
                icon={<Calendar />} 
                placeholder="Fecha de Nacimiento" 
                type="date"
                value={birthDate} 
                onChange={setBirthDate} 
                isDarkMode={isDarkMode}
                required
              />
            </div>
          )}

          <div className="space-y-4">
            {(!isManual || isLogin) && (
              <Input 
                icon={<Mail />} 
                placeholder="Correo Electrónico" 
                type="email"
                value={email} 
                onChange={setEmail} 
                isDarkMode={isDarkMode}
                required
              />
            )}
            <Input 
              icon={<Lock />} 
              placeholder="Contraseña" 
              type="password"
              value={password} 
              onChange={setPassword} 
              isDarkMode={isDarkMode}
              required
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm font-medium bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          <button 
            type="submit"
            disabled={loading}
            className="w-full h-16 bg-gradient-to-r from-[#B8860B] to-[#FFD700] text-black rounded-2xl font-bold text-lg flex items-center justify-center gap-3 shadow-xl active:scale-[0.98] transition-all disabled:opacity-50 mt-8"
          >
            {loading ? 'Procesando...' : (isLogin ? 'Entrar' : 'Registrarse')}
            {!loading && <ArrowRight className="w-5 h-5" />}
          </button>
        </form>

        {/* Footer Links */}
        <div className="mt-8 space-y-4 text-center">
          {isLogin ? (
            <>
              <p className="opacity-60 font-medium">¿No tienes cuenta?</p>
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setIsLogin(false); setIsManual(false); }}
                  className="text-[#B8860B] font-bold hover:underline"
                >
                  Registrarse con Correo
                </button>
                <button 
                  onClick={() => { setIsLogin(false); setIsManual(true); }}
                  className="text-[#B8860B] font-bold hover:underline"
                >
                  Registro Manual (Sin Correo)
                </button>
              </div>
            </>
          ) : (
            <button 
              onClick={() => setIsLogin(true)}
              className="flex items-center justify-center gap-2 text-[#B8860B] font-bold mx-auto hover:underline"
            >
              <ChevronLeft className="w-5 h-5" />
              Volver al Inicio de Sesión
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Input = ({ 
  icon, 
  placeholder, 
  value, 
  onChange, 
  type = "text", 
  isDarkMode,
  required = false
}: { 
  icon: React.ReactNode, 
  placeholder: string, 
  value: string, 
  onChange: (v: string) => void,
  type?: string,
  isDarkMode: boolean,
  required?: boolean
}) => (
  <div className={cn(
    "relative flex items-center h-14 rounded-xl border transition-all duration-300",
    isDarkMode 
      ? "bg-[#1A1A1A] border-white/10 focus-within:border-[#B8860B]" 
      : "bg-white border-[#e8e8e5] focus-within:border-[#B8860B] shadow-sm"
  )}>
    <div className="pl-4 text-[#B8860B]">
      {React.cloneElement(icon as React.ReactElement, { className: "w-5 h-5" })}
    </div>
    <input 
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      className={cn(
        "flex-1 bg-transparent border-none focus:ring-0 px-4 font-medium",
        isDarkMode ? "text-[#FDFBF0] placeholder:text-[#FDFBF0]/30" : "text-[#2e2f2d] placeholder:text-[#5b5c5a]/50"
      )}
    />
  </div>
);
