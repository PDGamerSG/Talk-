import TitleBar from './components/TitleBar';
import DevTest from './components/DevTest';

export default function App(): JSX.Element {
  return (
    <div className="app-shell">
      <TitleBar />
      <main className="content" style={{ alignItems: 'stretch' }}>
        <DevTest />
      </main>
    </div>
  );
}
