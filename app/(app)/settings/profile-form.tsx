"use client";

import { useState, useTransition } from "react";
import { Loader2, Upload } from "lucide-react";
import { notify, notifyError } from "@/lib/ui/feedback";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { initials } from "@/lib/utils";
import { updateProfile, getAvatarPath } from "./actions";

export function ProfileForm({
  currentName,
  currentAvatarUrl,
  currentJobTitle,
  currentBio,
}: {
  currentName: string;
  currentAvatarUrl?: string | null;
  currentJobTitle?: string | null;
  currentBio?: string | null;
}) {
  const [name, setName] = useState(currentName);
  const [jobTitle, setJobTitle] = useState(currentJobTitle ?? "");
  const [bio, setBio] = useState(currentBio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl ?? "");
  const [uploading, setUploading] = useState(false);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify({ title: "Foto deve ter no maximo 2MB", tone: "error" });
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const userId = await getAvatarPath();
      const ext = file.name.split(".").pop() || "png";
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = pub.publicUrl;
      await updateProfile({ fullName: name, jobTitle, bio, avatarUrl: publicUrl });
      setAvatarUrl(`${publicUrl}?t=${Date.now()}`);
      notify({ title: "Foto atualizada" });
    } catch (err) {
      notifyError(err);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setMsg(null);
    start(async () => {
      try {
        await updateProfile({ fullName: name, jobTitle, bio });
        setMsg("Perfil atualizado com sucesso.");
      } catch (err) {
        setMsg((err as Error).message);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={avatarUrl || undefined} alt={name} />
          <AvatarFallback className="text-base">{initials(name)}</AvatarFallback>
        </Avatar>
        <Label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-input/80 px-3 py-2 text-sm hover:bg-muted">
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Enviando..." : "Trocar foto"}
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={uploading} />
        </Label>
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-name">Seu nome</Label>
        <Input
          id="profile-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Digite seu nome"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-job-title">Cargo</Label>
        <Input
          id="profile-job-title"
          value={jobTitle}
          onChange={(e) => setJobTitle(e.target.value)}
          placeholder="Ex: Vendedor Senior"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="profile-bio">Bio</Label>
        <Textarea
          id="profile-bio"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Uma frase curta sobre voce"
          rows={3}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{msg}</p>
        <Button type="submit" variant="brand" disabled={pending || !name.trim()}>
          {pending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
      </div>
    </form>
  );
}
