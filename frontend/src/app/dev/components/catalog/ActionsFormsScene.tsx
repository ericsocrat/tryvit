"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { CatalogRow, CatalogSection, CatalogSpecimen } from "./CatalogFrame";
import type { CatalogCopy } from "./registry";

export function ActionsFormsScene({ copy }: Readonly<{ copy: CatalogCopy }>) {
  const actions = copy.actions;
  const [automaticUpdates, setAutomaticUpdates] = useState(false);
  const [includeContext, setIncludeContext] = useState(false);
  const [notes, setNotes] = useState(actions.notesValue);

  return (
    <CatalogSection id="actions-forms" title={copy.scenes["actions-forms"]}>
      <CatalogSpecimen label={copy.specimenLabel} note={copy.specimenNote}>
        <CatalogRow label={actions.buttons}>
          <button className="catalog-v2-button" data-variant="primary" type="button">
            {actions.primary}
          </button>
          <button className="catalog-v2-button" data-variant="secondary" type="button">
            {actions.secondary}
          </button>
          <button className="catalog-v2-button" data-variant="quiet" type="button">
            {actions.quiet}
          </button>
          <button className="catalog-v2-button" data-variant="destructive" type="button">
            {actions.destructive}
          </button>
          <button className="catalog-v2-button" data-size="small" type="button">
            {actions.small}
          </button>
          <button className="catalog-v2-button" data-size="medium" type="button">
            {actions.medium}
          </button>
          <button className="catalog-v2-button" data-size="large" type="button">
            {actions.large}
          </button>
          <button aria-busy="true" className="catalog-v2-button" disabled type="button">
            {actions.loading}
          </button>
          <button className="catalog-v2-button" disabled type="button">
            {actions.disabled}
          </button>
        </CatalogRow>

        <button className="catalog-v2-button w-full" data-variant="primary" type="button">
          {actions.fullWidth}
        </button>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="catalog-v2-field">
            <span>{actions.defaultField}</span>
            <input placeholder={actions.defaultPlaceholder} type="text" />
          </label>
          <label className="catalog-v2-field">
            <span>{actions.invalidField}</span>
            <input
              aria-describedby="catalog-source-error"
              aria-invalid="true"
              defaultValue={actions.invalidValue}
              type="text"
            />
            <span className="catalog-v2-error" id="catalog-source-error" role="alert">
              {actions.requiredError}
            </span>
          </label>
          <label className="catalog-v2-field">
            <span>{actions.hintField}</span>
            <input aria-describedby="catalog-source-hint" maxLength={100} type="text" />
            <span className="catalog-v2-muted" id="catalog-source-hint">
              {actions.hint}
            </span>
          </label>
          <label className="catalog-v2-field">
            <span>{actions.searchField}</span>
            <span className="catalog-v2-input-with-icon">
              <Search aria-hidden="true" size={16} />
              <input placeholder={actions.searchPlaceholder} type="search" />
            </span>
          </label>
          <label className="catalog-v2-field">
            <span>{actions.disabledField}</span>
            <textarea defaultValue={actions.disabledValue} readOnly rows={2} />
          </label>
          <label className="catalog-v2-field">
            <span>{actions.category}</span>
            <select defaultValue="">
              <option disabled value="">{actions.chooseCategory}</option>
              {actions.categoryOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>

        <label className="catalog-v2-field max-w-2xl">
          <span>{actions.notes}</span>
          <textarea
            aria-describedby="catalog-notes-hint"
            maxLength={500}
            onChange={(event) => setNotes(event.currentTarget.value)}
            rows={3}
            value={notes}
          />
          <span className="catalog-v2-field-meta" id="catalog-notes-hint">
            <span>{actions.notesHint}</span>
            <span>{notes.length} / 500</span>
          </span>
        </label>

        <CatalogRow label={actions.controls}>
          <button
            aria-checked={automaticUpdates}
            className="catalog-v2-switch"
            onClick={() => setAutomaticUpdates((current) => !current)}
            role="switch"
            type="button"
          >
            <span aria-hidden="true" className="catalog-v2-switch-track"><span /></span>
            {automaticUpdates ? actions.switchOn : actions.switchOff}
          </button>
          <span className="catalog-v2-switch" data-checked="true">
            <span aria-hidden="true" className="catalog-v2-switch-track"><span /></span>
            {actions.switchOn}
          </span>
          <button aria-checked="false" className="catalog-v2-switch" disabled role="switch" type="button">
            <span aria-hidden="true" className="catalog-v2-switch-track"><span /></span>
            {actions.disabled}
          </button>
          <label className="catalog-v2-checkbox">
            <input
              checked={includeContext}
              onChange={(event) => setIncludeContext(event.currentTarget.checked)}
              type="checkbox"
            />
            {actions.checkboxDefault}
          </label>
          <label className="catalog-v2-checkbox">
            <input defaultChecked type="checkbox" />
            {actions.checkboxChecked}
          </label>
          <span className="catalog-v2-mixed-checkbox">
            <span aria-hidden="true">−</span>
            {actions.checkboxMixed}
          </span>
        </CatalogRow>
      </CatalogSpecimen>
    </CatalogSection>
  );
}
