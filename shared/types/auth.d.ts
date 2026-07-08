declare module '#auth-utils' {
  interface User {
    id: number
    email: string
    name: string
    role: string
  }

  interface SecureSessionData {
    userId: number
  }
}

export {}
