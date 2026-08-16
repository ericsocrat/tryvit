import { Button } from "@/design-system/primitives/Button/Button";
import {
  Checkbox,
  Input,
  Select,
  Switch,
  Textarea,
} from "@/design-system/primitives/Field";
import { IconButton } from "@/design-system/primitives/IconButton/IconButton";

import { ButtonActivationProbe } from "./ButtonActivationProbe.client";
import {
  CatalogCombobox,
  type CatalogComboboxState,
} from "./CatalogCombobox.client";
import { CatalogSwitch } from "./CatalogSwitch.client";
import { CatalogRow, CatalogSection, CatalogSpecimen } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

const comboboxStates = ["ready", "loading", "empty", "error"] as const satisfies
  readonly CatalogComboboxState[];

export function ActionsFormsScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const actions = copy.actions;
  const interaction = copy.interaction;
  const primitives = copy.primitives;

  return (
    <CatalogSection id="actions-forms" title={copy.scenes["actions-forms"]}>
      <CatalogSpecimen label={copy.specimenLabel} note={copy.specimenNote}>
        <CatalogRow label={actions.buttons}>
          <ButtonActivationProbe label={actions.primary} resultLabel={primitives.activated} />
          <Button variant="secondary">{actions.secondary}</Button>
          <Button variant="quiet">{actions.quiet}</Button>
          <Button variant="destructive">{actions.destructive}</Button>
          <Button size="sm">{actions.small}</Button>
          <Button size="md">{actions.medium}</Button>
          <Button size="lg">{actions.large}</Button>
          <Button loading loadingLabel={actions.loading}>{actions.primary}</Button>
          <Button disabled>{actions.disabled}</Button>
          <IconButton icon="action.settings" label={interaction.settings} variant="secondary" />
          <IconButton icon="action.delete" label={interaction.remove} variant="destructive" />
        </CatalogRow>

        <Button fullWidth endIcon="action.continue">
          {actions.fullWidth}
        </Button>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <Input
            data-catalog-probe="field-input"
            label={actions.defaultField}
            placeholder={actions.defaultPlaceholder}
            type="text"
          />
          <Input
            announceError
            defaultValue={actions.invalidValue}
            error={actions.requiredError}
            label={actions.invalidField}
            required
            requiredLabel={primitives.requiredLabel}
            type="text"
          />
          <Input
            hint={actions.hint}
            label={actions.hintField}
            maxLength={100}
            type="text"
          />
          <Input
            label={actions.searchField}
            placeholder={actions.searchPlaceholder}
            type="search"
          />
          <Textarea
            defaultValue={actions.disabledValue}
            label={actions.disabledField}
            readOnly
            rows={2}
          />
          <Select defaultValue="" label={actions.category}>
            <option disabled value="">{actions.chooseCategory}</option>
            {actions.categoryOptions.map((option) => <option key={option}>{option}</option>)}
          </Select>
        </div>

        <Textarea
          count={{
            current: actions.notesValue.length,
            maximum: 500,
            label: actions.notesHint,
          }}
          defaultValue={actions.notesValue}
          id="catalog-review-notes"
          label={actions.notes}
          maxLength={500}
          rows={3}
        />

        <CatalogRow label={actions.controls}>
          <CatalogSwitch
            label={actions.switchLabel}
            offLabel={actions.switchOff}
            onLabel={actions.switchOn}
            probe="field-switch"
          />
          <div className="catalog-v2-direction-probe" dir="rtl">
            <CatalogSwitch
              defaultChecked
              label={actions.switchLabel}
              offLabel={actions.switchOff}
              onLabel={actions.switchOn}
              probe="field-switch-rtl"
            />
          </div>
          <Switch disabled label={actions.disabled} />
          <Checkbox
            data-catalog-probe="field-checkbox"
            label={actions.checkboxDefault}
          />
          <Checkbox defaultChecked label={actions.checkboxChecked} />
          <Checkbox indeterminate label={actions.checkboxMixed} />
        </CatalogRow>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {comboboxStates.map((state) => (
            <CatalogCombobox
              emptyMessage={primitives.comboboxEmpty}
              hint={primitives.comboboxHint}
              key={state}
              label={primitives.comboboxLabel}
              loadError={primitives.comboboxError}
              loadingMessage={primitives.comboboxLoading}
              optionLabels={primitives.comboboxOptions}
              placeholder={primitives.comboboxPlaceholder}
              resultsMessage={primitives.comboboxResults}
              state={state}
            />
          ))}
        </div>
      </CatalogSpecimen>
    </CatalogSection>
  );
}
