import React from 'react'
import Card from '../ui/Card'

type Student = {
  id: string
  username: string
  join_code?: string
}

type Props = {
  students: Student[]
  selectedStudent: string | null
  onSelectStudent: (id: string) => void
}

export default function StudentList({ students, selectedStudent, onSelectStudent }: Props) {
  if (students.length === 0) {
    return (
      <Card className="text-center p-8">
        <div className="text-gray-500 mb-2">Henüz öğrenciniz bulunmuyor.</div>
        <p className="text-sm text-gray-400">
          Öğrencileriniz kayıt olurken katılım kodunuzu girerek size bağlanabilirler.
        </p>
      </Card>
    )
  }

  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-4 py-3 border-b bg-gray-50/50">
        <h3 className="font-semibold text-gray-700">Öğrencileriniz</h3>
      </div>
      <div className="divide-y max-h-[500px] overflow-y-auto">
        {students.map(s => (
          <button
            key={s.id}
            onClick={() => onSelectStudent(s.id)}
            className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-indigo-50 transition-colors ${
              selectedStudent === s.id ? 'bg-indigo-50 border-l-4 border-indigo-500' : 'border-l-4 border-transparent'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center text-indigo-600 font-bold">
                {s.username.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className={`font-medium ${selectedStudent === s.id ? 'text-indigo-700' : 'text-gray-800'}`}>
                  {s.username}
                </div>
                <div className="text-xs text-gray-500">ID: {s.id.slice(0, 8)}...</div>
              </div>
            </div>
            <div className="text-indigo-400">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </div>
          </button>
        ))}
      </div>
    </Card>
  )
}
