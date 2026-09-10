import React from 'react'
import { AcademicCapIcon, ChartBarIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { Link, Outlet } from 'react-router-dom'

const benefits = [
  { icon: ChartBarIcon, title: 'Gelişimini görünür kıl', text: 'Netlerin ve çalışma düzenin aynı yerde.' },
  { icon: CheckCircleIcon, title: 'Sıradaki adımını bil', text: 'Hedefler, görevler ve mentor desteği.' },
]

export default function AuthLayout() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <section className="hidden flex-col justify-between border-r border-indigo-100 bg-indigo-50/60 p-12 lg:flex xl:p-20">
        <Link to="/login" className="flex items-center gap-3 text-xl font-semibold text-slate-900">
          <AcademicCapIcon aria-hidden="true" className="h-9 w-9 text-indigo-600" /> YKS Mentor
        </Link>
        <div className="my-12 max-w-lg">
          <p className="eyebrow">Her adımın bir yönü olsun</p>
          <h1 className="mt-5 text-5xl font-semibold leading-tight text-slate-900">Hedefini gör.<br />Gelişimini takip et.</h1>
          <p className="mt-6 text-lg leading-8 text-slate-600">Çalışmalarını, hedeflerini ve mentor görüşmelerini tek bir yerde buluştur. Bir sonraki adımını birlikte netleştirelim.</p>
          <div className="mt-10 space-y-3">
            {benefits.map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-4 rounded-2xl border border-white bg-white/80 p-5 shadow-sm">
                <Icon aria-hidden="true" className="h-6 w-6 shrink-0 text-indigo-600" />
                <div><p className="font-semibold text-slate-800">{title}</p><p className="mt-1 text-sm text-slate-500">{text}</p></div>
              </div>
            ))}
          </div>
        </div>
        <p className="text-sm text-slate-500">Küçük adımlar. Düzenli gelişim.</p>
      </section>
      <section className="flex items-center justify-center bg-white px-5 py-10 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/login" className="mb-8 flex items-center gap-2 text-lg font-semibold text-slate-900 lg:hidden">
            <AcademicCapIcon aria-hidden="true" className="h-7 w-7 text-indigo-600" /> YKS Mentor
          </Link>
          <Outlet />
        </div>
      </section>
    </main>
  )
}
