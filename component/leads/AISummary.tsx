import type { AiSummary } from "./types";

type Props = {
  summary: AiSummary | null;
};

export function AISummary({ summary }: Props) {
  if (!summary) {
    return (
      <div className="lm-empty lm-empty--inset">
        No AI summary yet. A summary appears here after a completed call.
      </div>
    );
  }

  return (
    <div className="lm-ai">
      <section>
        <h3>Conversation summary</h3>
        <p>{summary.conversationSummary}</p>
      </section>

      <section>
        <h3>Customer requirements / interests</h3>
        <ul>
          {summary.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Key discussion points</h3>
        <ul>
          {summary.keyPoints.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Customer objections</h3>
        <ul>
          {summary.objections.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Recommended next action</h3>
        <p>{summary.recommendedNextAction}</p>
      </section>

      <section>
        <h3>Follow-up information</h3>
        <p>{summary.followUp}</p>
      </section>
    </div>
  );
}
