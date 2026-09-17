import { AppointmentForm } from "@/component/AppointmentForm";
import { prisma } from "@/lib/db";
import { getCurrentWorkspace } from "@/lib/workspace";
import "../../auth.css";
import "../calls.css";

export default async function AppointmentsPage() {
  const { business } = await getCurrentWorkspace();

  const [appointments, leads] = await Promise.all([
    prisma.appointment.findMany({
      where: { businessId: business.id },
      include: { lead: true },
      orderBy: { date: "asc" },
    }),
    prisma.lead.findMany({
      where: { businessId: business.id },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <>
      <header className="dash-header">
        <h1>Appointments</h1>
        <p>Schedule demo or counselling sessions with leads.</p>
      </header>

      <section className="dash-panel">
        <h2>Schedule</h2>
        <AppointmentForm
          leads={leads.map((l) => ({ id: l.id, name: `${l.name} (${l.phone})` }))}
        />
      </section>

      <section className="dash-panel" style={{ marginTop: 16 }}>
        <h2>Upcoming</h2>
        {appointments.length === 0 ? (
          <p>No appointments yet.</p>
        ) : (
          <ul className="simple-list">
            {appointments.map((a) => (
              <li key={a.id}>
                <strong>
                  {a.lead.name} · {a.date.toLocaleDateString()}
                  {a.time ? ` ${a.time}` : ""}
                </strong>
                <span>
                  {a.type || "appointment"} · {a.status}
                </span>
                {a.notes ? <em>{a.notes}</em> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
