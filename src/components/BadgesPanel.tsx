import { useMemo, useState, type FC } from 'react';
import Badge from './Badge';
import { BADGE_DEFINITIONS, type StoredAchievement } from '../lib/achievements';

interface BadgesPanelProps {
  achievements: StoredAchievement[];
  className?: string;
}

const BadgesPanel: FC<BadgesPanelProps> = ({ achievements, className }) => {
  const [expanded, setExpanded] = useState(false);
  const achievementMap = useMemo(() => {
    const map = new Map<string, StoredAchievement>();
    achievements.forEach((item) => {
      map.set(item.code, item);
    });
    return map;
  }, [achievements]);

  const earnedCount = achievementMap.size;
  const totalBadges = BADGE_DEFINITIONS.length;
  const visibleBadges = expanded ? BADGE_DEFINITIONS : BADGE_DEFINITIONS.slice(0, 4);
  const remaining = totalBadges - visibleBadges.length;

  return (
    <section
      className={`card flex h-full flex-col gap-4 rounded-3xl border border-border bg-card/90 p-4 sm:p-6 ${className ?? ''}`}
    >
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground sm:text-xl">Pencapaian</h2>
          <p className="text-xs text-muted-foreground sm:text-sm">
            {earnedCount}/{totalBadges} badge diraih
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-full border border-border px-3 py-1 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/10 sm:px-4 sm:py-2 sm:text-sm"
          onClick={() => setExpanded((prev) => !prev)}
          aria-expanded={expanded}
        >
          {expanded ? 'Sembunyikan' : 'Lihat Pencapaian'}
        </button>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibleBadges.map((badge) => (
          <Badge
            key={badge.code}
            title={badge.title}
            description={badge.description}
            emoji={badge.emoji}
            earnedAt={achievementMap.get(badge.code)?.earned_at}
          />
        ))}
      </div>
      {!expanded && remaining > 0 && (
        <p className="text-xs text-muted-foreground">
          {remaining} badge lainnya menunggu kamu.
        </p>
      )}
    </section>
  );
};

export default BadgesPanel;
