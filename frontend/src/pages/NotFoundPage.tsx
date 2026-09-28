import { ButtonLink } from '../components/ui/Button';
import { Logo } from '../layouts/Logo';

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <Logo large />
      <div>
        <p className="text-sm font-semibold text-blue-600">404</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Page not found</h1>
        <p className="mt-2 text-sm text-slate-600">The page you are looking for doesn&apos;t exist or has moved.</p>
      </div>
      <ButtonLink to="/">Go to your home page</ButtonLink>
    </div>
  );
}
