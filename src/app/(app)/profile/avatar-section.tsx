"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { adoptGravatar, removeAvatar, uploadAvatar } from "@/actions/profile";
import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";

const SOURCE_LABEL: Record<string, string> = {
  gravatar: "Showing your Gravatar.",
  upload: "Showing a photo you uploaded.",
  initials: "Showing your initials.",
};

export function AvatarSection({
  name,
  email,
  image,
  avatarSource,
}: {
  name: string;
  email: string;
  image: string | null;
  avatarSource: string;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(work: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    setError(null);
    startTransition(async () => {
      const result = await work();
      if (result.ok) {
        toast.success(success);
      } else {
        setError(result.error ?? "That did not work.");
      }
    });
  }

  function onFileChosen(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("avatar", file);
    run(() => uploadAvatar(null, formData), "Photo updated");
    // Allow re-picking the same file after a failure.
    event.target.value = "";
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-5">
        <Avatar name={name} src={image} className="size-20 text-xl" />
        <div className="space-y-1">
          <p className="font-medium">{name}</p>
          <p className="text-muted-foreground readout text-xs">{email}</p>
          <p className="text-muted-foreground text-xs">
            {SOURCE_LABEL[avatarSource] ?? SOURCE_LABEL.initials}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={onFileChosen}
          disabled={pending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() => fileInput.current?.click()}
        >
          Upload a photo
        </Button>

        {avatarSource !== "gravatar" ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pending}
            onClick={() => run(adoptGravatar, "Now showing your Gravatar")}
          >
            Use my Gravatar
          </Button>
        ) : null}

        {image ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={pending}
            onClick={() => run(removeAvatar, "Photo removed")}
          >
            Remove
          </Button>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="text-destructive max-w-md text-sm">
          {error}
        </p>
      ) : null}
    </section>
  );
}
