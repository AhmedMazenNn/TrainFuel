import { db } from "../offline/database";
import { useEffect, useState, useRef, type FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useLanguage } from "../contexts/LanguageContext";
import { Field, Message } from "../components/Primitives";
import {
  records,
  save,
  openDay,
  localDate,
  totals,
  nutrients,
  targets,
  type Row,
} from "./store";
import { nutritionCopy } from "./copy";
import "./nutrition.css";
const blankFood = () => ({
  name: "",
  portion_g: "",
  calories_kcal: "",
  protein_g: "",
  carbs_g: "",
  fat_g: "",
  brand_source: "",
  notes: "",
  status: "draft",
});
export function NutritionPage() {
  const { account } = useAuth(),
    { language } = useLanguage();
  const c = nutritionCopy[language],
    owner = account!.user.id,
    initialToday = localDate(account!.profile.timezone);
  const [today, setToday] = useState(initialToday),
    [newDay, setNewDay] = useState(false);
  useEffect(() => {
    const timer = setInterval(() => {
      const now = localDate(account!.profile.timezone);
      if (now !== today) {
        setToday(now);
        setNewDay(true);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [today, account!.profile.timezone]);
  const [date, setDate] = useState(today),
    [days, setDays] = useState<Row[]>([]),
    [entries, setEntries] = useState<Row[]>([]),
    [schedules, setSchedules] = useState<Row[]>([]),
    [recovered, setRecovered] = useState<Record<string, unknown>[]>([]),
    [food, setFood] = useState<Record<string, string>>(blankFood),
    [edit, setEdit] = useState<Row | null>(null),
    [foodDate, setFoodDate] = useState(today),
    [snapshot, setSnapshot] = useState<Record<string, string>>({}),
    [schedule, setSchedule] = useState<Record<string, string>>({
      effective_date: today,
      goal: account!.profile.goal,
      calories_kcal: "",
      protein_g: "",
      carbs_g: "",
      fat_g: "",
    }),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [remove, setRemove] = useState<Row | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    snapshotBase = useRef<Row | null>(null),
    scheduleBase = useRef<Row | null>(null);
  async function reload() {
    const [d, e, t] = await Promise.all([
      records(owner, "nutrition_day"),
      records(owner, "food_entry"),
      records(owner, "nutrition_target"),
    ]);
    setDays(d);
    setEntries(e);
    setSchedules(t);
    setRecovered(
      (await (await db).getAllFromIndex("drafts", "owner", owner))
        .filter((row) => row.operation.entity_type === "food_entry")
        .map((row) => row.operation.payload),
    );
  }
  useEffect(() => {
    void reload();
    window.addEventListener("trainfuel-local-change", reload);
    return () => window.removeEventListener("trainfuel-local-change", reload);
  }, [owner]);
  const day = days.find((d) => d.local_date === date),
    dayEntries = entries.filter((e) => e.day === day?.id);
  useEffect(() => {
    setFoodDate(date);
    snapshotBase.current = null;
  }, [date]);
  useEffect(() => {
    if (snapshotBase.current) return;
    setSnapshot({
      ...Object.fromEntries(
        targets.map((key) => [key, day?.[key] == null ? "" : String(day[key])]),
      ),
      goal_snapshot: String(day?.goal_snapshot ?? account!.profile.goal),
    });
  }, [date, day?.id, day?.revision]);
  function valid(
    values: Record<string, string>,
    keys: readonly string[],
    nullable: boolean,
  ) {
    return keys.every(
      (k) =>
        (nullable && values[k] === "") ||
        (values[k] !== "" &&
          Number.isFinite(Number(values[k])) &&
          Number(values[k]) >= 0 &&
          Number(values[k]) <= 999999999.999 &&
          /^\d+(\.\d{1,3})?$/.test(values[k])),
    );
  }
  async function action(task: () => Promise<unknown>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await task();
      await reload();
      setMessage(c.saved);
    } catch {
      setError(c.validation);
    } finally {
      setBusy(false);
    }
  }
  async function open(selected: string) {
    if (selected > today) {
      setError(c.future);
      return;
    }
    await action(async () => {
      await openDay(owner, selected, account!.profile.goal);
      setDate(selected);
    });
  }
  async function saveFood(event: FormEvent) {
    event.preventDefault();
    if (
      !food.name.trim() ||
      !valid(food, ["portion_g"], false) ||
      Number(food.portion_g) <= 0 ||
      !valid(food, nutrients, food.status === "draft") ||
      foodDate > today
    ) {
      setError(foodDate > today ? c.future : c.validation);
      return;
    }
    await action(async () => {
      const dest = await openDay(owner, foodDate, account!.profile.goal);
      const data: Row = {
        id: edit?.id ?? crypto.randomUUID(),
        revision: edit?.revision ?? 0,
        day: dest.id,
        ...food,
      };
      nutrients.forEach((k) => (data[k] = food[k] === "" ? null : food[k]));
      await save(owner, "food_entry", data, edit ? "update" : "create");
      setFood(blankFood());
      setEdit(null);
      setDate(foodDate);
    });
  }
  function fill(row: Row, copy = false) {
    setEdit(copy ? null : row);
    setFood(
      Object.fromEntries(
        Object.keys(blankFood()).map((k) => [
          k,
          row[k] == null ? "" : String(row[k]),
        ]),
      ),
    );
    setFoodDate(date);
    document
      .getElementById("food-form")
      ?.scrollIntoView({ behavior: "instant", block: "start" });
  }
  const num = (value: number) =>
    new Intl.NumberFormat(language, { maximumFractionDigits: 3 }).format(value);
  const weekStart = new Date(date + "T12:00:00Z");
  weekStart.setUTCDate(
    weekStart.getUTCDate() - ((weekStart.getUTCDay() + 6) % 7),
  );
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const history = weekDates.map((d) => {
    const item = days.find((r) => r.local_date === d),
      foods = entries.filter((r) => r.day === item?.id);
    return { date: d, foods, totals: totals(foods, item) };
  });
  const logged = history.filter((h) => h.foods.length);
  const chartMax = Math.max(
    1,
    ...history.flatMap((h) => [h.totals[0].consumed, h.totals[0].target ?? 0]),
  );
  return (
    <section className="nutrition-page">
      <header className="page-heading">
        <p className="eyebrow">TrainFuel</p>
        <h1 tabIndex={-1}>{c.title}</h1>
        <p>{c.intro}</p>
      </header>
      <div className="surface nutrition-toolbar">
        <Field
          label={c.date}
          type="date"
          max={today}
          value={date}
          onChange={(e) => {
            if (e.target.value) setDate(e.target.value);
          }}
        />
        <button
          className="button primary"
          disabled={busy}
          onClick={() => open(today)}
        >
          {c.start}
        </button>
        {!day && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => open(date)}
          >
            {c.open}
          </button>
        )}
      </div>
      {newDay && date !== today && <Message success>{c.todayChanged}</Message>}
      {error && <Message>{error}</Message>}
      {message && <Message success>{message}</Message>}
      {!day && <p>{c.empty}</p>}
      {day && (
        <>
          <div className="nutrition-counters">
            {totals(dayEntries, day).map((v) => (
              <article className="surface nutrient-card" key={v.key}>
                <h2>{c[v.key]}</h2>
                <p className="nutrient-value">
                  {num(v.consumed)} /{" "}
                  {v.target == null ? c.unknown : num(v.target)}
                </p>
                <p>
                  {v.target == null
                    ? c.targetMissing
                    : v.target >= v.consumed
                      ? `${num(v.target - v.consumed)} ${c.remaining}`
                      : `${num(v.consumed - v.target)} ${c.over}`}
                </p>
                {v.partial && <small>{c.partial}</small>}
                {!v.observed && <small>{c.none}</small>}
              </article>
            ))}
          </div>
          <div className="nutrition-columns">
            <form
              id="food-form"
              className="surface nutrition-form"
              onSubmit={saveFood}
            >
              <h2>{edit ? c.edit : c.save}</h2>
              <p>{c.portionHint}</p>
              <Field
                label={c.name}
                value={food.name}
                maxLength={300}
                required
                onChange={(e) => setFood({ ...food, name: e.target.value })}
              />
              <Field
                label={c.move}
                type="date"
                max={today}
                value={foodDate}
                required
                onChange={(e) => setFoodDate(e.target.value)}
              />
              <Field
                label={c.portion}
                type="number"
                min="0.001"
                step="0.001"
                required
                value={food.portion_g}
                onChange={(e) =>
                  setFood({ ...food, portion_g: e.target.value })
                }
              />
              <div className="nutrition-fields">
                {nutrients.map((k) => (
                  <Field
                    key={k}
                    label={c[k]}
                    type="number"
                    min="0"
                    step="0.001"
                    placeholder={c.unknown}
                    value={food[k]}
                    onChange={(e) => setFood({ ...food, [k]: e.target.value })}
                  />
                ))}
              </div>
              <Field
                label={c.source}
                value={food.brand_source}
                onChange={(e) =>
                  setFood({ ...food, brand_source: e.target.value })
                }
              />
              <Field
                label={c.notes}
                value={food.notes}
                maxLength={10000}
                onChange={(e) => setFood({ ...food, notes: e.target.value })}
              />
              <label>
                {c.status}
                <select
                  value={food.status}
                  onChange={(e) => setFood({ ...food, status: e.target.value })}
                >
                  <option value="draft">{c.draft}</option>
                  <option value="complete">{c.complete}</option>
                </select>
              </label>
              <div className="sync-actions">
                <button className="button primary" disabled={busy}>
                  {c.save}
                </button>
                {edit && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setEdit(null);
                      setFood(blankFood());
                    }}
                  >
                    {c.cancel}
                  </button>
                )}
              </div>
            </form>
            <div>
              <form
                className="surface nutrition-form snapshot-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!valid(snapshot, targets, true)) {
                    setError(c.validation);
                    return;
                  }
                  void action(async () => {
                    await save(
                      owner,
                      "nutrition_day",
                      {
                        ...(snapshotBase.current ?? day),
                        goal_snapshot: snapshot.goal_snapshot,
                        ...Object.fromEntries(
                          targets.map((k) => [
                            k,
                            snapshot[k] === "" ? null : snapshot[k],
                          ]),
                        ),
                      },
                      "update",
                    );
                    snapshotBase.current = null;
                  });
                }}
              >
                <h2>{c.targets}</h2>
                <p>{c.snapshotHint}</p>
                <label>
                  {c.goal}
                  <select
                    value={
                      snapshot.goal_snapshot ?? (day.goal_snapshot as string)
                    }
                    onChange={(e) => {
                      snapshotBase.current ??= { ...day };
                      setSnapshot({
                        ...snapshot,
                        goal_snapshot: e.target.value,
                      });
                    }}
                  >
                    <option value="cutting">{c.cutting}</option>
                    <option value="bulking">{c.bulking}</option>
                  </select>
                </label>
                <div className="nutrition-fields">
                  {targets.map((k, i) => (
                    <Field
                      key={k}
                      label={c[nutrients[i]]}
                      type="number"
                      min="0"
                      step="0.001"
                      value={snapshot[k] ?? ""}
                      onChange={(e) => {
                        snapshotBase.current ??= { ...day };
                        setSnapshot({ ...snapshot, [k]: e.target.value });
                      }}
                    />
                  ))}
                </div>
                <button className="button secondary" disabled={busy}>
                  {c.saveTargets}
                </button>
              </form>
              <div className="surface nutrition-entries">
                <h2>
                  {c.title} · {date}
                </h2>
                {!dayEntries.length && <p>{c.none}</p>}
                {dayEntries.map((entry) => (
                  <article key={entry.id}>
                    <h3>{String(entry.name)}</h3>
                    <p>
                      {num(Number(entry.portion_g))} g ·{" "}
                      {entry.status === "draft" ? c.draft : c.complete}
                    </p>
                    <dl>
                      {nutrients.map((k) => (
                        <div key={k}>
                          <dt>{c[k]}</dt>
                          <dd>
                            {entry[k] == null
                              ? c.unknown
                              : num(Number(entry[k]))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <div className="sync-actions">
                      <button
                        className="button secondary"
                        onClick={() => fill(entry)}
                      >
                        {c.edit}
                      </button>
                      <button
                        className="button secondary"
                        onClick={() => fill(entry, true)}
                      >
                        {c.copy}
                      </button>
                      <button
                        className="button danger"
                        onClick={() => {
                          setRemove(entry);
                          dialog.current?.showModal();
                        }}
                      >
                        {c.remove}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
      {recovered.length > 0 && (
        <section className="surface nutrition-form">
          <h2>{c.recover}</h2>
          {recovered.map((payload, index) => (
            <p key={index}>
              {String(payload.name)}{" "}
              <button
                className="button secondary"
                onClick={() =>
                  fill(
                    { ...payload, id: crypto.randomUUID(), revision: 0 } as Row,
                    true,
                  )
                }
              >
                {c.restore}
              </button>
            </p>
          ))}
        </section>
      )}
      <details className="surface nutrition-schedule">
        <summary>{c.schedule}</summary>
        <form
          className="nutrition-form"
          onSubmit={(e) => {
            e.preventDefault();
            if (!valid(schedule, nutrients, false)) {
              setError(c.validation);
              return;
            }
            void action(async () => {
              const existing = scheduleBase.current;
              const data: Row = {
                id: existing?.id ?? crypto.randomUUID(),
                revision: existing?.revision ?? 0,
                ...schedule,
              };
              await save(
                owner,
                "nutrition_target",
                data,
                existing ? "update" : "create",
              );
              scheduleBase.current = { ...data, revision: data.revision + 1 };
            });
          }}
        >
          <p>{c.scheduleHint}</p>
          <Field
            label={c.effective}
            type="date"
            value={schedule.effective_date}
            required
            onChange={(e) =>
              setSchedule({ ...schedule, effective_date: e.target.value })
            }
          />
          <label>
            {c.goal}
            <select
              value={schedule.goal}
              onChange={(e) =>
                setSchedule({ ...schedule, goal: e.target.value })
              }
            >
              <option value="cutting">{c.cutting}</option>
              <option value="bulking">{c.bulking}</option>
            </select>
          </label>
          <div className="nutrition-fields">
            {nutrients.map((k) => (
              <Field
                key={k}
                label={c[k]}
                required
                type="number"
                min="0"
                step="0.001"
                value={schedule[k]}
                onChange={(e) =>
                  setSchedule({ ...schedule, [k]: e.target.value })
                }
              />
            ))}
          </div>
          <button className="button primary" disabled={busy}>
            {c.saveSchedule}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={() => {
              scheduleBase.current = null;
              setSchedule({
                effective_date: today,
                goal: account!.profile.goal,
                calories_kcal: "",
                protein_g: "",
                carbs_g: "",
                fat_g: "",
              });
            }}
          >
            {c.cancel}
          </button>
          <h3>{c.scheduleList}</h3>
          {schedules.map((s) => (
            <p key={s.id}>
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  scheduleBase.current = s;
                  setSchedule(
                    Object.fromEntries(
                      ["effective_date", "goal", ...nutrients].map((k) => [
                        k,
                        String(s[k]),
                      ]),
                    ),
                  );
                }}
              >
                {String(s.effective_date)} · {num(Number(s.calories_kcal))} kcal
              </button>
              <button
                type="button"
                className="button secondary"
                onClick={() =>
                  action(() => save(owner, "nutrition_target", s, "delete"))
                }
              >
                {c.remove}
              </button>
            </p>
          ))}
        </form>
      </details>
      <section className="surface nutrition-history">
        <h2>{c.history}</h2>
        <p>
          {c.logged}: {num(logged.length)} / 7. {c.denominator}
        </p>
        <div className="nutrition-chart" aria-hidden="true">
          {history.map((h) => (
            <div key={h.date}>
              <div
                className="nutrition-bar"
                style={{
                  height: h.foods.length
                    ? `${(130 * h.totals[0].consumed) / chartMax}px`
                    : "0",
                }}
              />
              {h.totals[0].target != null && (
                <span
                  className="nutrition-target-marker"
                  style={{
                    bottom: `${25 + (130 * h.totals[0].target) / chartMax}px`,
                  }}
                />
              )}
              <small>{h.date.slice(5)}</small>
            </div>
          ))}
        </div>
        <div className="table-scroll">
          <table>
            <caption>{c.consumed}</caption>
            <thead>
              <tr>
                <th>{c.date}</th>
                {nutrients.map((k) => (
                  <th key={k}>{c[k]}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {history.map((h) => (
                <tr key={h.date}>
                  <th>
                    <button
                      className="text-link"
                      onClick={() => setDate(h.date)}
                    >
                      {h.date}
                    </button>
                  </th>
                  {h.totals.map((v) => (
                    <td key={v.key}>
                      {h.foods.length
                        ? `${num(v.consumed)} / ${v.target == null ? c.unknown : num(v.target)}${v.partial ? " *" : ""}`
                        : c.missing}
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <th>
                  {c.average} ({logged.length})
                </th>
                {nutrients.map((k, i) => (
                  <td key={k}>
                    {logged.length
                      ? num(
                          logged.reduce(
                            (sum, h) => sum + h.totals[i].consumed,
                            0,
                          ) / logged.length,
                        )
                      : c.unknown}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p>* {c.partial}</p>
      </section>
      <dialog
        ref={dialog}
        className="logout-dialog"
        aria-labelledby="food-delete"
      >
        <h2 id="food-delete">{c.deleteConfirm}</h2>
        <div className="sync-actions">
          <button
            className="button danger"
            onClick={() => {
              if (remove)
                void action(() => save(owner, "food_entry", remove, "delete"));
              dialog.current?.close();
            }}
          >
            {c.confirm}
          </button>
          <button
            className="button secondary"
            onClick={() => dialog.current?.close()}
          >
            {c.back}
          </button>
        </div>
      </dialog>
    </section>
  );
}
