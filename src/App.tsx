import TitleBar from './components/TitleBar';

export default function App(): JSX.Element {
  return (
    <div className="app-shell">
      <TitleBar />
      <main className="content">
        <div className="phase-banner">Talk+ — Phase 0 scaffold running</div>
      </main>
    </div>
  );
}
