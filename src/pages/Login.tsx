import { useState } from 'react'
import { ArrowRight, CheckCircle2, CircleAlert, Eye, EyeOff, LockKeyhole, ShieldCheck, UserRound, Wrench } from 'lucide-react'
import { useAuth } from '../auth'
import { useRouter } from '../router'

export function Login() {
  const { login } = useAuth()
  const { navigate } = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setLoading(true)

    window.setTimeout(() => {
      if (login(username, password, remember)) navigate('/', { replace: true })
      else {
        setError('Usuário ou senha incorretos. Confira os dados e tente novamente.')
        setLoading(false)
      }
    }, 450)
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <div className="login-brand-panel__glow login-brand-panel__glow--one" />
        <div className="login-brand-panel__glow login-brand-panel__glow--two" />
        <div className="login-brand">
          <span className="login-brand__mark">GB</span>
          <span><strong>Gente Boa</strong><small>Gestão</small></span>
        </div>

        <div className="login-pitch">
          <span className="login-pitch__eyebrow"><Wrench size={14} /> Gestão simples. Serviço bem feito.</span>
          <h1>Toda a operação da Gente Boa, em um só lugar.</h1>
          <p>Acompanhe clientes, serviços, faturamento e resultados com clareza do início ao fim.</p>
          <div className="login-benefits">
            <span><CheckCircle2 size={17} /> Ordens de serviço em tempo real</span>
            <span><CheckCircle2 size={17} /> Faturamento e extratos integrados</span>
            <span><CheckCircle2 size={17} /> Indicadores para decisões mais rápidas</span>
          </div>
        </div>

        <div className="login-brand-panel__footer">
          <span className="login-footer-icon"><ShieldCheck size={18} /></span>
          <span><strong>Ambiente protegido</strong><small>Acesso exclusivo para a equipe Gente Boa</small></span>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-mobile-brand">
          <span className="login-brand__mark">GB</span>
          <span><strong>Gente Boa</strong><small>Gestão</small></span>
        </div>

        <div className="login-card">
          <div className="login-demo-notice"><ShieldCheck size={15} /> Ambiente demonstrativo · todos os dados são fictícios</div>
          <header>
            <span className="login-card__welcome">Bem-vinda de volta</span>
            <h2>Acesse sua conta</h2>
            <p>Entre com seus dados para continuar no sistema.</p>
          </header>

          <form onSubmit={submit}>
            <label className="login-field">
              <span>Usuário</span>
              <div className={error ? 'login-input login-input--error' : 'login-input'}>
                <UserRound size={18} />
                <input
                  autoFocus
                  autoComplete="username"
                  value={username}
                  onChange={(event) => { setUsername(event.target.value); setError('') }}
                  placeholder="Digite seu usuário"
                  required
                />
              </div>
            </label>

            <label className="login-field">
              <span>Senha</span>
              <div className={error ? 'login-input login-input--error' : 'login-input'}>
                <LockKeyhole size={18} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setError('') }}
                  placeholder="Digite sua senha"
                  required
                />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>

            {error && <div className="login-error" role="alert"><CircleAlert size={17} /><span>{error}</span></div>}

            <div className="login-options">
              <label><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span>Manter conectado</span></label>
              <button type="button">Esqueci minha senha</button>
            </div>

            <button className="login-submit" type="submit" disabled={loading}>
              {loading ? <><i />Validando acesso...</> : <>Entrar no sistema <ArrowRight size={18} /></>}
            </button>
          </form>

          <div className="demo-credentials">
            <div><span>Acesso de demonstração</span><small>Use as credenciais abaixo para entrar.</small></div>
            <dl><div><dt>Usuário</dt><dd>naty</dd></div><div><dt>Senha</dt><dd>naty12345</dd></div></dl>
          </div>

          <footer>Gente Boa Manutenção e Serviços <span>•</span> Protótipo 2026</footer>
        </div>
      </section>
    </main>
  )
}
