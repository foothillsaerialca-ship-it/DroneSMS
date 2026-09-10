import { Outlet } from 'react-router-dom';
import { CopyrightFooter } from './copyright-footer';

export function PageFooterLayout() {
  return (
    <div className="flex min-h-full w-full flex-col">
      <div className="flex-1">
        <Outlet />
      </div>
      <CopyrightFooter />
    </div>
  );
}
