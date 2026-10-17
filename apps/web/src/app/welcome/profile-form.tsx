import { Button, Input } from "@/components/ui";

export const ROLES = ["Founder", "Engineer", "Product", "Finance", "Other"];
export const TEAM_SIZES = ["Just me", "2–10", "11–50", "51+"];

export interface ProfileValues {
  fullName?: string;
  company?: string;
  website?: string | null;
  role?: string | null;
  teamSize?: string | null;
}

const select = "w-full rounded border border-foreground/20 bg-transparent px-3 py-1.5 text-sm";

export function ProfileForm({ action, values = {}, submit }: { action: (fd: FormData) => Promise<void>; values?: ProfileValues; submit: string }) {
  return (
    <form action={action} className="flex flex-col gap-3 text-sm">
      <label className="flex flex-col gap-1">
        <span className="font-medium">Your name</span>
        <Input name="fullName" required maxLength={100} defaultValue={values.fullName ?? ""} autoComplete="name" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">Company or app</span>
        <Input name="company" required maxLength={100} defaultValue={values.company ?? ""} autoComplete="organization" />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-medium">
          Website <span className="font-normal text-foreground/50">(optional)</span>
        </span>
        <Input name="website" maxLength={200} placeholder="https://" defaultValue={values.website ?? ""} autoComplete="url" />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Role <span className="font-normal text-foreground/50">(optional)</span>
          </span>
          <select name="role" className={select} defaultValue={values.role ?? ""}>
            <option value="">—</option>
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-medium">
            Team size <span className="font-normal text-foreground/50">(optional)</span>
          </span>
          <select name="teamSize" className={select} defaultValue={values.teamSize ?? ""}>
            <option value="">—</option>
            {TEAM_SIZES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </label>
      </div>
      <Button type="submit" className="mt-2 py-2">
        {submit}
      </Button>
    </form>
  );
}
