import type { Pacing, StyleControls, StyleProfile } from '../../types'
import { useStore } from '../../store/useStore'
import { Field, Modal, Slider } from '../../components/ui'
import { InspireButton } from '../../components/InspireButton'

const PACING_OPTIONS: Pacing[] = [
  'slow-burn', 'balanced', 'fast', 'cinematic', 'lyrical', 'sparse', 'high-intensity',
]

type SliderKey = Exclude<keyof StyleControls, 'pacing'>

const SLIDERS: { key: SliderKey; label: string }[] = [
  { key: 'proseDensity', label: 'Prose Density' },
  { key: 'vocabulary', label: 'Vocabulary' },
  { key: 'dialogueFrequency', label: 'Dialogue Frequency' },
  { key: 'interiorMonologue', label: 'Interior Monologue' },
  { key: 'humor', label: 'Humor' },
  { key: 'darkness', label: 'Darkness' },
  { key: 'romance', label: 'Romance' },
  { key: 'violence', label: 'Violence' },
  { key: 'surrealism', label: 'Surrealism' },
]

export function ProfileEditor(props: { profile: StyleProfile; onClose: () => void }) {
  const { profile, onClose } = props
  const updateStyleProfile = useStore((s) => s.updateStyleProfile)
  const deleteStyleProfile = useStore((s) => s.deleteStyleProfile)

  const remove = () => {
    if (!confirm(`Delete style profile "${profile.name}"? This cannot be undone.`)) return
    deleteStyleProfile(profile.id)
    onClose()
  }

  return (
    <Modal title="Edit Voiceprint" onClose={onClose}>
      <Field label="Name">
        <input
          type="text"
          value={profile.name}
          onChange={(e) =>
            updateStyleProfile(profile.id, (d) => {
              d.name = e.target.value
            })
          }
        />
      </Field>
      <Field label="Description" hint="What kind of prose does this voice produce?">
        <div className="row" style={{ justifyContent: 'flex-end', marginBottom: 4 }}>
          <InspireButton
            title="Describe this voice from its name and dials"
            build={() => ({
              system:
                'You describe prose styles for a fiction studio, in the register of "Dense but readable prose. Slow dread. Sensory description. Dialogue carries subtext." — clipped, concrete fragments.',
              user:
                `Write a 2-3 line style description for a voice named "${profile.name}" with these dials (0-10): ` +
                `density ${profile.controls.proseDensity}, vocabulary ${profile.controls.vocabulary}, dialogue ${profile.controls.dialogueFrequency}, ` +
                `interiority ${profile.controls.interiorMonologue}, humor ${profile.controls.humor}, darkness ${profile.controls.darkness}, ` +
                `romance ${profile.controls.romance}, violence ${profile.controls.violence}, surrealism ${profile.controls.surrealism}, pacing ${profile.controls.pacing}. ` +
                'Output only the description.',
              maxTokens: 150,
            })}
            onText={(t) => updateStyleProfile(profile.id, (d) => { d.description = t })}
          />
        </div>
        <textarea
          value={profile.description}
          rows={3}
          onChange={(e) =>
            updateStyleProfile(profile.id, (d) => {
              d.description = e.target.value
            })
          }
        />
      </Field>

      <div className="divider" />
      <div className="kicker" style={{ marginBottom: 10 }}>Style Dials</div>
      <div className="grid-2">
        {SLIDERS.map(({ key, label }) => (
          <Slider
            key={key}
            label={label}
            value={profile.controls[key]}
            onChange={(v) =>
              updateStyleProfile(profile.id, (d) => {
                d.controls[key] = v
              })
            }
          />
        ))}
      </div>

      <Field label="Pacing">
        <select
          value={profile.controls.pacing}
          onChange={(e) =>
            updateStyleProfile(profile.id, (d) => {
              d.controls.pacing = e.target.value as Pacing
            })
          }
        >
          {PACING_OPTIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid-2">
        <Field label="POV Lock" hint="Leave blank for none.">
          <input
            type="text"
            value={profile.povLock}
            placeholder="third person limited (Mara)"
            onChange={(e) =>
              updateStyleProfile(profile.id, (d) => {
                d.povLock = e.target.value
              })
            }
          />
        </Field>
        <Field label="Tense Lock" hint="Leave blank for none.">
          <input
            type="text"
            value={profile.tenseLock}
            placeholder="past tense"
            onChange={(e) =>
              updateStyleProfile(profile.id, (d) => {
                d.tenseLock = e.target.value
              })
            }
          />
        </Field>
      </div>

      <Field label="Voice Notes" hint="Free-form guidance: sentence habits, forbidden words, signature moves.">
        <textarea
          value={profile.voiceNotes}
          rows={4}
          onChange={(e) =>
            updateStyleProfile(profile.id, (d) => {
              d.voiceNotes = e.target.value
            })
          }
        />
      </Field>

      <div className="row between">
        <button className="btn small danger" onClick={remove}>
          Delete Profile
        </button>
        <button className="btn primary" onClick={onClose}>
          Done
        </button>
      </div>
    </Modal>
  )
}
