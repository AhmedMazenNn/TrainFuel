import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Field, Message } from "../components/Primitives";
import { db, type LocalEntity } from "../offline/database";
import { progressCopy } from "./copy";
import { records, remove, save } from "./storage";
export function ReminderScheduler() {
  const { account } = useAuth();
  const { language } = useLanguage();
  useEffect(() => {
    if (!account || !("Notification" in window)) return;
    let alive = true;
    const delivered: Notification[] = [];
    const cancel = () => {
      alive = false;
      for (const item of delivered) item.close();
      void navigator.serviceWorker
        ?.getRegistration()
        .then(async (registration) => {
          for (const notification of (await registration?.getNotifications()) ??
            [])
            if (notification.tag.startsWith(`trainfuel-${account.user.id}-`))
              notification.close();
        });
    };
    window.addEventListener("trainfuel-account-erased", cancel);
    const owner = account.user.id;
    const notify = async () => {
      if (
        !alive ||
        Notification.permission !== "granted" ||
        document.visibilityState !== "visible"
      )
        return;
      const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: account.profile.timezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
        weekday: "short",
      }).formatToParts(new Date());
      const get = (t: string) => parts.find((p) => p.type === t)?.value || "";
      const day =
        ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(
          get("weekday"),
        ) + 1;
      for (const row of await records(owner, "reminder")) {
        const r = row.data!;
        if (
          !r.enabled ||
          !(r.weekdays as number[]).includes(day) ||
          String(r.local_time).slice(0, 5) !== `${get("hour")}:${get("minute")}`
        )
          continue;
        const key = `reminder-fired:${owner}:${row.id}:${get("year")}-${get("month")}-${get("day")}:${get("hour")}:${get("minute")}`;
        const run = async () => {
          const database = await db;
          const tx = database.transaction("meta", "readwrite");
          if (
            !alive ||
            (await tx.store.get("active")) !== owner ||
            (await tx.store.get(key))
          ) {
            await tx.done;
            return;
          }
          await tx.store.put(true, key);
          await tx.done;
          if (!alive || (await database.get("meta", "active")) !== owner)
            return;
          const options = {
            body: progressCopy[language].generic,
            tag: `trainfuel-${owner}-${row.id}`,
          };
          const registration = await navigator.serviceWorker?.getRegistration();
          try {
            if (registration?.showNotification)
              await registration.showNotification("TrainFuel", options);
            else delivered.push(new Notification("TrainFuel", options));
          } catch {
            /* Permission/platform denial leaves the application usable. */
          }
        };
        if (navigator.locks)
          await navigator.locks.request(`notification:${owner}:${row.id}`, run);
        else await run();
      }
    };
    const interval = setInterval(() => void notify().catch(() => {}), 15000);
    void notify().catch(() => {});
    return () => {
      cancel();
      window.removeEventListener("trainfuel-account-erased", cancel);
      clearInterval(interval);
    };
  }, [account?.user.id, account?.profile.timezone, language]);
  return null;
}
export function RemindersPage() {
  const { account } = useAuth();
  const { language } = useLanguage();
  const c = progressCopy[language];
  const owner = account!.user.id;
  const [rows, setRows] = useState<LocalEntity[]>([]),
    [edit, setEdit] = useState<LocalEntity>(),
    [category, setCategory] = useState("weight"),
    [time, setTime] = useState("09:00"),
    [days, setDays] = useState("1,2,3,4,5,6,7"),
    [enabled, setEnabled] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [permission, setPermission] = useState(
      "Notification" in window ? Notification.permission : "unsupported",
    );
  useEffect(() => {
    const update = () => void records(owner, "reminder").then(setRows);
    update();
    window.addEventListener("trainfuel-local-change", update);
    return () => window.removeEventListener("trainfuel-local-change", update);
  }, [owner]);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      const weekdays = days.split(",").map(Number);
      if (
        !weekdays.length ||
        new Set(weekdays).size !== weekdays.length ||
        weekdays.some((d) => !Number.isInteger(d) || d < 1 || d > 7)
      )
        throw Error();
      await save(
        owner,
        "reminder",
        { category, local_time: time, weekdays, enabled },
        edit,
      );
      setMessage(c.saved);
      setEdit(undefined);
    } catch {
      setError(c.error);
    }
  }
  return (
    <section className="settings-card">
      <h1 tabIndex={-1}>{c.reminders}</h1>
      <p>{c.reminderIntro}</p>
      <p>
        {c.permission}: {permission}
      </p>
      {permission === "unsupported" && <Message>{c.unsupported}</Message>}
      {permission === "denied" && <Message>{c.denied}</Message>}
      {message && <Message success>{message}</Message>}
      {error && <Message>{error}</Message>}
      <form onSubmit={submit}>
        <label>
          {c.category}
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {(["food", "exercise", "weight", "photo"] as const).map((k) => (
              <option value={k} key={k}>
                {c[k]}
              </option>
            ))}
          </select>
        </label>
        <Field
          label={c.time}
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
        <Field
          label={c.days}
          required
          value={days}
          onChange={(e) => setDays(e.target.value)}
        />
        <label className="progress-cache">
          <input
            type="checkbox"
            checked={enabled}
            onChange={async (e) => {
              const next = e.target.checked;
              if (next && "Notification" in window) {
                const result =
                  Notification.permission === "default"
                    ? await Notification.requestPermission()
                    : Notification.permission;
                setPermission(result);
              }
              setEnabled(next);
            }}
          />
          {c.enabled}
        </label>
        <button className="button primary">{c.save}</button>
        {edit && (
          <button type="button" onClick={() => setEdit(undefined)}>
            {c.cancel}
          </button>
        )}
      </form>
      <ul className="progress-history">
        {rows.map((row) => (
          <li key={row.id}>
            <span>
              {c[row.data!.category as "weight"]} ·{" "}
              {String(row.data!.local_time)} ·{" "}
              {(row.data!.weekdays as number[]).join(",")} ·{" "}
              {String(row.data!.enabled)}
            </span>
            <button
              onClick={() => {
                setEdit(row);
                setCategory(String(row.data!.category));
                setTime(String(row.data!.local_time).slice(0, 5));
                setDays((row.data!.weekdays as number[]).join(","));
                setEnabled(Boolean(row.data!.enabled));
              }}
            >
              {c.edit}
            </button>
            <button
              onClick={() => {
                if (window.confirm(c.confirm)) void remove(owner, row);
              }}
            >
              {c.delete}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
