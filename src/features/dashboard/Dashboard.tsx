import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useTranslation } from 'react-i18next';

const data = [
  { name: 'Mon', amount: 120 },
  { name: 'Tue', amount: 200 },
  { name: 'Wed', amount: 150 },
  { name: 'Thu', amount: 80 },
  { name: 'Fri', amount: 70 },
  { name: 'Sat', amount: 110 },
  { name: 'Sun', amount: 90 }
];

export default function Dashboard() {
  const { t } = useTranslation();
  return (
    <div className="p-4">
      <h1 className="text-2xl mb-4">{t('welcome')}</h1>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <Line type="monotone" dataKey="amount" stroke="#8884d8" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
