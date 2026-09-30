import Link from "next/link";
import { notFound } from "next/navigation";
import { AppointmentActions } from "@/component/AppointmentActions";
import { AppointmentStatusBadge } from "@/component/AppointmentStatusBadge";
import { getCallSummaryForBusiness } from "@/lib/ai/summarize-call";
import {
  allowedNextStatuses,
  formatAppointmentWhen,
  getAppointment,
  typeLabel,
} from "@/lib/appointments/booking";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../../auth.css";
import "../../calls.css";
import "../../campaigns/campaigns.css";
import "../appointments.css";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function AppointmentDetailPage({ params }: Props) {
  const { id } = await params;
  const { business } = await getCurrentWorkspace();
  const timezone = business.timezone || "Asia/Kolkata";

  const appointment = await getAppointment(business.id, id);
  if (!appointment) notFound();

  const when = formatAppointmentWhen(appointment, timezone);
  const summary = appointment.callId
    ? await getCallSummaryForBusiness(business.id, appointment.callId)
    : null;
  const created = appointment.createdAt.toLocaleString("en-IN", {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <>
      <header className="dash-header agent-header">
        <div>
          <h1>
            {typeLabel(appointment.type)} with {appointment.lead.name}
          </h1>
          <p>
            {when.date} · {when.time} <AppointmentStatusBadge status={appointment.status} />
          </p>
        </div>
        <Link href="/dashboard/appointments" className="agent-cancel">
          ← All appointments
        </Link>
      </header>

      <section className="dash-panel">
        <h2>Details</h2>
        <dl className="appointment-details">
          <dt>Customer</dt>
          <dd>{appointment.lead.name}</dd>
          <dt>Phone</dt>
          <dd>{appointment.lead.phone}</dd>
          <dt>Email</dt>
          <dd>{appointment.lead.email || "—"}</dd>
          <dt>Date</dt>
          <dd>{when.date}</dd>
          <dt>Time</dt>
          <dd>
            {when.time}
            {appointment.endAt ? ` (${timezone})` : ""}
          </dd>
          <dt>Appointment type</dt>
          <dd>{typeLabel(appointment.type)}</dd>
          <dt>Status</dt>
          <dd>
            <AppointmentStatusBadge status={appointment.status} />
          </dd>
          <dt>Booked by</dt>
          <dd>{appointment.agent ? `AI agent ${appointment.agent.name}` : "Team (dashboard)"}</dd>
          <dt>Created</dt>
          <dd>{created}</dd>
          <dt>Related lead</dt>
          <dd>
            <Link
              href={`/dashboard/leads/${appointment.lead.id}`}
              className="campaign-table-action"
            >
              {appointment.lead.name}
            </Link>
          </dd>
          <dt>Related call</dt>
          <dd>
            {appointment.call ? (
              <Link
                href={`/dashboard/calls/${appointment.call.id}`}
                className="campaign-table-action"
              >
                View call ({appointment.call.status.toLowerCase()})
              </Link>
            ) : (
              "—"
            )}
          </dd>
          {appointment.notes ? (
            <>
              <dt>Notes</dt>
              <dd>{appointment.notes}</dd>
            </>
          ) : null}
        </dl>
      </section>

      <section className="dash-panel">
        <h2>Actions</h2>
        <AppointmentActions
          appointmentId={appointment.id}
          allowed={allowedNextStatuses(appointment.status)}
        />
      </section>

      {summary?.state === "ready" ? (
        <section className="dash-panel">
          <h2>Call summary</h2>
          <p>{summary.summary}</p>
        </section>
      ) : null}
    </>
  );
}
