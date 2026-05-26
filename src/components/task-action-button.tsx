"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { mirrorWorkflowEvent, readPersisted, writePersisted } from "@/lib/browser-persistence";
import { Button } from "./ui";

export function TaskActionButton({
  taskId,
  label,
}: {
  taskId: string;
  label: string;
}) {
  const [completedIds, setCompletedIds] = useState<string[]>(() =>
    readPersisted<string[]>("brobroker:dashboard:completed-tasks", []),
  );
  const isDone = completedIds.includes(taskId);

  function completeTask() {
    const next = [...new Set([taskId, ...completedIds])];
    setCompletedIds(next);
    writePersisted("brobroker:dashboard:completed-tasks", next);
    mirrorWorkflowEvent("dashboard_task_completed", taskId, { taskId });
  }

  return (
    <Button
      className="self-start md:self-auto"
      disabled={isDone}
      onClick={completeTask}
      size="sm"
      type="button"
      variant="secondary"
    >
      {isDone ? (
        <>
          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
          Done
        </>
      ) : (
        <>
          {label}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </>
      )}
    </Button>
  );
}
