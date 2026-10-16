import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      email: string;
      name: string;
      image: string;
      role: 'super_admin' | 'admin' | 'viewer';
      adminId: string;
    };
  }
}
