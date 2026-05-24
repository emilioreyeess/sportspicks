"use client"
import { LegalPage, LegalSection } from "@/components/legal/LegalPage"
import { revokeConsent } from "@/lib/compliance"

export default function GdprPage() {
  return (
    <LegalPage title="GDPR — Gestión de Datos Personales" lastUpdated="22 de mayo de 2026">
      <LegalSection title="Tus derechos bajo el RGPD">
        <div className="grid sm:grid-cols-2 gap-2">
          {[
            { right: "Acceso", desc: "Obtén una copia de todos los datos que tenemos sobre ti" },
            { right: "Rectificación", desc: "Corrige datos incorrectos o incompletos" },
            { right: "Supresión", desc: "Solicita la eliminación completa de tu cuenta y datos" },
            { right: "Portabilidad", desc: "Exporta tus datos en formato legible por máquina (JSON)" },
            { right: "Limitación", desc: "Solicita que limitemos el tratamiento de tus datos" },
            { right: "Oposición", desc: "Oponte al tratamiento por interés legítimo" },
          ].map((r) => (
            <div key={r.right} className="bg-zinc-900 border border-zinc-800 rounded-xl p-3">
              <p className="text-sm font-bold text-emerald-400">{r.right}</p>
              <p className="text-xs text-zinc-500 mt-0.5">{r.desc}</p>
            </div>
          ))}
        </div>
      </LegalSection>

      <LegalSection title="Ejercer tus derechos">
        <p>Para ejercer cualquier derecho envía un email a <strong className="text-zinc-300">legal@sportspicks.app</strong> con:</p>
        <ul className="list-disc pl-4 space-y-1 text-zinc-500">
          <li>Asunto: "Ejercicio de derechos GDPR"</li>
          <li>Tu email de registro</li>
          <li>El derecho que deseas ejercer</li>
          <li>Una copia de documento de identidad (para verificar identidad)</li>
        </ul>
        <p>Respondemos en un máximo de 30 días naturales.</p>
      </LegalSection>

      <LegalSection title="Gestión de consentimiento de cookies">
        <p>Puedes retirar tu consentimiento de cookies en cualquier momento:</p>
        <button
          onClick={revokeConsent}
          className="mt-2 px-4 py-2 bg-red-500/15 border border-red-800 text-red-400
            text-sm rounded-xl hover:bg-red-500/25 transition-colors"
        >
          Retirar consentimiento y gestionar cookies
        </button>
      </LegalSection>

      <LegalSection title="Exportar mis datos">
        <p>Puedes solicitar una exportación completa de tus datos desde tu perfil o enviando un email a legal@sportspicks.app.</p>
        <p>El archivo de exportación incluirá: datos de cuenta, historial de picks visualizados, historial de retos, preferencias y metadatos de uso anonimizados.</p>
      </LegalSection>

      <LegalSection title="Eliminación de cuenta">
        <p>La eliminación de cuenta borra permanentemente: todos tus datos personales, historial de uso, preferencias y conversaciones del bot. <strong className="text-zinc-300">Esta acción es irreversible.</strong></p>
        <p>Los datos de facturación se conservan el tiempo requerido por la normativa fiscal (6 años en España), pero en forma anonimizada siempre que sea posible.</p>
        <button className="mt-2 px-4 py-2 bg-red-500/10 border border-red-900 text-red-500
          text-sm rounded-xl hover:bg-red-500/20 transition-colors">
          Solicitar eliminación de cuenta →
        </button>
      </LegalSection>

      <LegalSection title="Autoridad de control">
        <p>Si consideras que no hemos atendido correctamente tus derechos, puedes presentar una reclamación ante:</p>
        <p><strong className="text-zinc-300">AEPD</strong> (Agencia Española de Protección de Datos) — <a href="https://www.aepd.es" target="_blank" rel="noopener noreferrer" className="underline text-zinc-400 hover:text-zinc-300">www.aepd.es</a></p>
      </LegalSection>
    </LegalPage>
  )
}
