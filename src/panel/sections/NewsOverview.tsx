import type { Doc } from '../../schema/document';
import { newsPhotoPosition, newsStoryWidth } from '../../lib/newsLayout';
import { useNewsProof } from '../../store/newsProof';

/** A compact issue-desk view: editors can see the story plan and the checks
 * that matter before exporting without opening every story card. */
export function NewsOverview({ doc }: { doc: Doc }) {
  const proof = useNewsProof(state => state.proof?.doc === doc ? state.proof : null);
  const stories = doc.news?.stories ?? [];
  const blocking = proof?.issues.filter(issue => issue.blocking) ?? [];
  const warnings = proof?.issues.filter(issue => !issue.blocking) ?? [];
  const status = !proof ? 'Measuring…' : blocking.length ? `${blocking.length} blocking` : warnings.length ? `${warnings.length} to check` : 'Ready to export';
  return <section className={`news-overview${blocking.length ? ' has-blocking' : ''}`} aria-label="Issue overview">
    <div className="news-overview-head">
      <div>
        <strong>Issue overview</strong>
        <span>{proof ? `${proof.pages} ${proof.pages === 1 ? 'page' : 'pages'} · ${stories.length} ${stories.length === 1 ? 'story' : 'stories'}` : 'Measuring the issue…'}</span>
      </div>
      <span className={`news-proof-badge${blocking.length ? ' is-blocking' : warnings.length ? ' is-warning' : ''}`}>
        {status}
      </span>
    </div>
    <ol className="news-overview-list">
      {stories.map((story, index) => {
        const placements = proof?.placements.filter(placement => placement.storyId === story.id) ?? [];
        const issueCount = proof?.issues.filter(issue => issue.storyId === story.id).length ?? 0;
        const width = newsStoryWidth(story, doc.design.bodyCols);
        const photo = newsPhotoPosition(story, width);
        return <li key={story.id} className={issueCount ? 'has-issue' : undefined}>
          <span className="news-overview-number">{index + 1}</span>
          <span className="news-overview-story">
            <strong>{story.title || 'Untitled brief'}</strong>
            <small>{width}/{doc.design.bodyCols} columns · {photo === 'none' ? 'text only' : `image ${photo}`}{placements.length ? ` · page ${placements[0].page}${placements.length > 1 ? `–${placements.at(-1)!.page}` : ''}` : ''}</small>
          </span>
          {issueCount > 0 && <span className="news-overview-issue" aria-label={`${issueCount} issue${issueCount === 1 ? '' : 's'}`}>{issueCount}</span>}
        </li>;
      })}
    </ol>
    {blocking.length > 0 && <p className="news-proof-message is-blocking">Resolve the blocking checks before exporting. The page preview marks the affected story.</p>}
    {blocking.length === 0 && warnings.length > 0 && <p className="news-proof-message">The issue can export, but review the flagged story notes first.</p>}
  </section>;
}
