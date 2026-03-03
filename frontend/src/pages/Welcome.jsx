import './Welcome.css';

const TABS = [
  {
    icon: '🎯',
    name: 'Dashboard',
    summary: 'Your skills hub',
    points: [
      'Add skills with a category, proficiency level, and importance rating',
      'See a health score for each skill based on how overdue its next review is',
      'Click Practice on any skill to get an AI-generated exercise tailored to your level',
      'Self-score the exercise — the app uses your score to schedule the next review using spaced repetition',
      'Edit or delete skills at any time',
    ],
  },
  {
    icon: '📊',
    name: 'Analytics',
    summary: 'Your progress over time',
    points: [
      'Track your current practice streak and total sessions',
      'View a 30-day activity heatmap showing which days you practised',
      'See per-skill average scores and session counts',
      'Earn achievement badges for 7-day, 30-day, and 100-day streaks',
      'Bar and line charts to visualise practice frequency and scores',
    ],
  },
];

const STEPS = [
  { num: '1', title: 'Add a skill', desc: 'Go to Dashboard and click "+ Add New Skill". Enter the skill name, category, proficiency level, and how important it is to you.' },
  { num: '2', title: 'Practice with AI', desc: 'Click the Practice button on any skill card. The app calls Amazon Bedrock to generate a personalised exercise. Read it, attempt it, then reveal the model answer.' },
  { num: '3', title: 'Score yourself', desc: 'Use the slider to score your attempt honestly (0–100). Submit — the app records your session and schedules the next review based on your score.' },
  { num: '4', title: 'Build your streak', desc: 'Come back each day to practice due skills. Check Analytics to see your streak grow, your scores improve, and badges unlock.' },
];

function Welcome({ userName, onNavigate }) {
  const firstName = userName ? userName.split(' ')[0] : null;

  return (
    <div className="welcome-page">

      {/* Hero */}
      <div className="welcome-hero">
        <div className="welcome-hero-icon">⚡</div>
        <h1 className="welcome-title">
          {firstName ? `Welcome back, ${firstName}!` : 'Welcome to SharpEdge!'}
        </h1>
        <p className="welcome-subtitle">
          Your AI-powered skill maintenance system — stay sharp with spaced repetition and personalised practice.
        </p>
        <button className="welcome-cta" onClick={() => onNavigate('dashboard')}>
          Go to Dashboard →
        </button>
      </div>

      {/* How it works */}
      <section className="welcome-section">
        <h2 className="welcome-section-title">How it works</h2>
        <div className="steps-grid">
          {STEPS.map(step => (
            <div key={step.num} className="step-card">
              <div className="step-num">{step.num}</div>
              <div className="step-body">
                <h3 className="step-title">{step.title}</h3>
                <p className="step-desc">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Tab guide */}
      <section className="welcome-section">
        <h2 className="welcome-section-title">What each tab does</h2>
        <div className="tabs-guide-grid">
          {TABS.map(tab => (
            <div key={tab.name} className="tab-guide-card">
              <div className="tab-guide-header">
                <span className="tab-guide-icon">{tab.icon}</span>
                <div>
                  <h3 className="tab-guide-name">{tab.name}</h3>
                  <p className="tab-guide-summary">{tab.summary}</p>
                </div>
              </div>
              <ul className="tab-guide-points">
                {tab.points.map((point, i) => (
                  <li key={i}>{point}</li>
                ))}
              </ul>
              <button
                className="tab-guide-link"
                onClick={() => onNavigate(tab.name.toLowerCase())}
              >
                Open {tab.name} →
              </button>
            </div>
          ))}
        </div>
      </section>

    </div>
  );
}

export default Welcome;
