export const TEACHER_ACTIVATION_INTENT = 'teacher_activation'

function storage() {
  return typeof window === 'undefined' ? null : window.sessionStorage
}

export function setTeacherActivationIntent() {
  try {
    storage()?.setItem(TEACHER_ACTIVATION_INTENT, 'pending')
  } catch {
    // Oturum depolaması kullanılamıyorsa giriş akışı çalışmaya devam eder.
  }
}

export function clearTeacherActivationIntent() {
  try {
    storage()?.removeItem(TEACHER_ACTIVATION_INTENT)
  } catch {
    // Oturum depolaması kullanılamıyorsa giriş akışı çalışmaya devam eder.
  }
}

export function hasTeacherActivationIntent() {
  try {
    return storage()?.getItem(TEACHER_ACTIVATION_INTENT) === 'pending'
  } catch {
    return false
  }
}

export function authenticatedDestination(role: 'teacher' | 'student') {
  if (role === 'teacher') {
    clearTeacherActivationIntent()
    return '/teacher'
  }

  return hasTeacherActivationIntent() ? '/student/activate-teacher' : '/student'
}
