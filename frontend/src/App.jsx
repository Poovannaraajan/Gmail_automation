import { useEffect, useState } from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Doughnut, Bar } from 'react-chartjs-2';
import './App.css';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

function App() {
  const [biData, setBiData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchData = async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const response = await fetch('/bi_data.json?t=' + new Date().getTime());
      if (!response.ok) throw new Error('Network response was not ok');
      const data = await response.json();
      setBiData(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError('Failed to load bi_data.json. Make sure backend has generated it.');
    } finally {
      setLoading(false);
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const processData = () => {
    const roleCounts = {};
    const companyRoles = [];
    const skillCounts = {};
    
    for (const filename in biData) {
      const data = biData[filename];
      if (!data) continue;
      
      const role = data.role || 'Unknown';
      const comp = data.company_name || 'Unknown';
      const skills = data.skills || [];
      
      roleCounts[role] = (roleCounts[role] || 0) + 1;
      companyRoles.push({ company: comp, role: role, skills: skills, file: filename });
      
      for (const skill of skills) {
          skillCounts[skill] = (skillCounts[skill] || 0) + 1;
      }
    }
    
    const roleLabels = Object.keys(roleCounts);
    const roleData = Object.values(roleCounts);
    
    const sortedSkills = Object.entries(skillCounts).sort((a,b) => b[1] - a[1]).slice(0, 10);
    const skillLabels = sortedSkills.map(x => x[0]);
    const skillData = sortedSkills.map(x => x[1]);

    return { roleLabels, roleData, skillLabels, skillData, companyRoles };
  };

  const { roleLabels, roleData, skillLabels, skillData, companyRoles } = processData();

  const roleChartData = {
    labels: roleLabels,
    datasets: [{
      data: roleData,
      backgroundColor: ['#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'],
      borderWidth: 0,
      hoverOffset: 4
    }]
  };

  const skillChartData = {
    labels: skillLabels,
    datasets: [{
      label: 'Companies asking for this skill',
      data: skillData,
      backgroundColor: '#3b82f6',
      borderRadius: 6,
    }]
  };
  
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    color: '#94a3b8',
    plugins: {
      legend: { labels: { color: '#f8fafc' } }
    }
  };

  return (
    <div className="app-container">
      <header className="header-container">
        <h1>Internship Intelligence</h1>
        <button className="refresh-btn" onClick={fetchData}>
          <svg className={`refresh-icon ${isRefreshing ? 'spinning' : ''}`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </header>

      {error && <div className="error-msg">{error}</div>}

      {loading ? (
        <div style={{textAlign:'center', marginTop:'50px'}}>Loading dashboard...</div>
      ) : (
        <>
          <div className="dashboard-grid">
            <div className="card">
              <h2>Roles Distribution</h2>
              <div className="chart-container">
                <Doughnut data={roleChartData} options={{...chartOptions, cutout: '70%', plugins: { legend: { position: 'right', labels: { color: '#f8fafc', padding: 20 } } }}} />
              </div>
            </div>
            
            <div className="card">
              <h2>Top Required Skills</h2>
              <div className="chart-container">
                <Bar data={skillChartData} options={{...chartOptions, scales: { y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { precision: 0 } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } }}} />
              </div>
            </div>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Role</th>
                  <th>Top Skills</th>
                  <th>Source File</th>
                </tr>
              </thead>
              <tbody>
                {companyRoles.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 500, color: '#fff' }}>{row.company}</td>
                    <td>{row.role}</td>
                    <td>
                      {row.skills.length > 0 ? (
                        <>
                          {row.skills.slice(0, 3).map((s, i) => <span key={i} className="badge">{s}</span>)}
                          {row.skills.length > 3 && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '5px' }}>+{row.skills.length - 3}</span>}
                        </>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>None listed</span>
                      )}
                    </td>
                    <td style={{ color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>{row.file}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
