import { createRootRoute, Link, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import styles from './root.module.css'

export const Route = createRootRoute({
  component: () => (
    <>
      <div className={styles.app}>
        <header className={styles.header}>
          <h1 className={styles.title}>LIVEFLOW FINANCIAL DASHBOARD</h1>
          <nav className={styles.nav}>
            <Link to="/" className={styles.navLink} activeProps={{ className: styles.activeNavLink }}>
              [HOME]
            </Link>
            <Link to="/anomalies" className={styles.navLink} activeProps={{ className: styles.activeNavLink }}>
              [ANOMALIES]
            </Link>
            <Link to="/create" className={styles.navLink} activeProps={{ className: styles.activeNavLink }}>
              [CREATE]
            </Link>
          </nav>
        </header>
        <main className={styles.main}>
          <Outlet />
        </main>
      </div>
      <TanStackRouterDevtools />
    </>
  ),
})