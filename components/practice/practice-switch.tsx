"use client"

import { useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

// The Procvičování switch in the subject forms. Turning it off asks first; the pages stay stored.
// The forms save the value with setPracticeEnabledAction after the subject itself is saved.
export function PracticeSwitch({ checked, onChange }: { checked: boolean; onChange: (_value: boolean) => void }) {
  const [confirmOff, setConfirmOff] = useState(false)

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border p-4">
      <div className="space-y-0.5">
        <Label htmlFor="practice-enabled">Procvičování</Label>
        <p className="text-sm text-muted-foreground">Příklady s řešením po krocích, jen pro přihlášené.</p>
      </div>
      <Switch
        id="practice-enabled"
        checked={checked}
        onCheckedChange={(value) => (value ? onChange(true) : setConfirmOff(true))}
      />
      <AlertDialog open={confirmOff} onOpenChange={setConfirmOff}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vypnout procvičování?</AlertDialogTitle>
            <AlertDialogDescription>Stránky zůstanou uložené, ale nebudou dostupné.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Zrušit</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                onChange(false)
                setConfirmOff(false)
              }}
            >
              Vypnout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
