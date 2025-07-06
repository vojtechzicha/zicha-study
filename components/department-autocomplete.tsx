"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface DepartmentAutocompleteProps {
  value: string
  onChange: (value: string) => void
  departments: string[]
  placeholder?: string
  disabled?: boolean
}

export function DepartmentAutocomplete({
  value,
  onChange,
  departments,
  placeholder = "Vyberte nebo zadejte katedru...",
  disabled = false,
}: DepartmentAutocompleteProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState("")

  const handleSelect = (currentValue: string) => {
    onChange(currentValue)
    setOpen(false)
    setInputValue("")
  }

  const handleInputChange = (search: string) => {
    setInputValue(search)
    if (search && !departments.includes(search)) {
      onChange(search)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between"
          disabled={disabled}
        >
          {value || placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <Command>
          <CommandInput 
            placeholder="Hledat katedru..." 
            value={inputValue}
            onValueChange={handleInputChange}
          />
          <CommandList>
            <CommandEmpty>
              {inputValue ? (
                <div 
                  className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent"
                  onClick={() => handleSelect(inputValue)}
                >
                  Použít &quot;{inputValue}&quot;
                </div>
              ) : (
                "Žádná katedra nenalezena."
              )}
            </CommandEmpty>
            <CommandGroup>
              {departments.map((department) => (
                <CommandItem
                  key={department}
                  value={department}
                  onSelect={() => handleSelect(department)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === department ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {department}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}