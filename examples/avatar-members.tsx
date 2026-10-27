import { Avatar } from "@/components/asciicn/avatar";
import type { AvatarStatus } from "@/components/asciicn/avatar";

const MEMBERS: readonly {
  name: string;
  email: string;
  role: string;
  status: AvatarStatus;
}[] = [
  {
    email: "ada@acme.dev",
    name: "Ada Lovelace",
    role: "Owner",
    status: "online",
  },
  {
    email: "alan@acme.dev",
    name: "Alan Turing",
    role: "Admin",
    status: "busy",
  },
  {
    email: "grace@acme.dev",
    name: "Grace Hopper",
    role: "Member",
    status: "away",
  },
  { email: "deploy-bot", name: "deploy-bot", role: "Bot", status: "offline" },
];

export default function AvatarMembers() {
  return (
    <ul className="bg-background flex w-full max-w-md flex-col divide-y rounded-lg border">
      {MEMBERS.map((member) => (
        <li key={member.email} className="flex items-center gap-3 px-4 py-3">
          <Avatar
            name={member.name}
            size={40}
            status={member.status}
            shape={member.role === "Bot" ? "square" : "circle"}
            color={member.role === "Bot" ? "grey" : undefined}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">{member.name}</span>
            <span className="text-muted-foreground truncate font-mono text-xs">
              {member.email}
            </span>
          </div>
          <span className="text-muted-foreground text-xs">{member.role}</span>
        </li>
      ))}
    </ul>
  );
}
