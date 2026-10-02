<?php

declare(strict_types=1);

namespace HelsingborgStad\MaterialSymbols\Script\Composer;

use Composer\Script\Event;
use InvalidArgumentException;
use RuntimeException;

/** Opt-in pruning of the installed reduced package. */
final class Prune
{
    private const PACKAGES = [
        'helsingborg-stad/material-design-icons-json-svg-font-reduced',
        'helsingborg-stad/material-design-icons-json-svg-font',
    ];
    private const FORMATS = ['svg', 'ttf', 'otf', 'woff', 'woff2'];
    private const KEYS = ['variants', 'weights', 'formats', 'symbols', 'staticFonts', 'variableFonts', 'dryRun'];

    public static function run(Event $event): void
    {
        $extra = $event->getComposer()->getPackage()->getExtra();
        $package = null;
        foreach (self::PACKAGES as $candidate) {
            if (array_key_exists($candidate, $extra)) {
                $package = $candidate;
                break;
            }
        }
        if ($package === null) {
            return;
        }
        $config = $extra[$package];
        if (!is_array($config)) {
            throw new InvalidArgumentException($package . ' config must be an object.');
        }
        $result = self::prune(dirname(__DIR__, 3), $config);
        $event->getIO()->write(sprintf('<info>Material Symbols: %s %d files (%.1f MiB).</info>', $result['dryRun'] ? 'Would remove' : 'Removed', $result['files'], $result['bytes'] / 1048576));
    }

    /** @return array{files:int,bytes:int,dryRun:bool} */
    public static function prune(string $root, array $config): array
    {
        foreach (array_keys($config) as $key) {
            if (!in_array($key, self::KEYS, true)) {
                throw new InvalidArgumentException("Unknown Material Symbols option: {$key}");
            }
        }
        if ($config === [] || !array_intersect(array_keys($config), array_diff(self::KEYS, ['dryRun']))) {
            throw new InvalidArgumentException('Specify at least one Material Symbols selection before pruning.');
        }
        $root = realpath($root) ?: throw new RuntimeException('Material Symbols package directory is missing.');
        $allVariants = self::array($root . '/variants.json');
        $allWeights = self::array($root . '/weight.json');
        $allSymbols = self::array($root . '/symbols.json');
        $variants = array_fill_keys(self::selection($config, 'variants', $allVariants), true);
        $weights = array_fill_keys(array_map('strval', self::selection($config, 'weights', $allWeights)), true);
        $symbols = array_fill_keys(self::selection($config, 'symbols', $allSymbols), true);
        $formats = array_fill_keys(self::selection($config, 'formats', self::FORMATS), true);
        $variableFonts = self::boolean($config, 'variableFonts', true);
        $dryRun = self::boolean($config, 'dryRun', false);
        $staticFonts = self::boolean($config, 'staticFonts', true);
        if (!isset($formats['svg']) && !($staticFonts && array_intersect(array_keys($formats), ['ttf', 'otf', 'woff', 'woff2'])) && !($variableFonts && array_intersect(array_keys($formats), ['ttf', 'woff', 'woff2']))) {
            throw new InvalidArgumentException('This selection would keep no assets.');
        }
        $result = ['files' => 0, 'bytes' => 0, 'dryRun' => $dryRun];
        foreach ($allVariants as $variant) {
            foreach ($allWeights as $weight) {
                $directory = $root . '/' . $variant . '/' . $weight;
                self::removeMatching($directory, static fn (string $file): bool => isset($formats['svg'], $variants[$variant], $weights[(string) $weight], $symbols[pathinfo($file, PATHINFO_FILENAME)]), $result, 'svg');
                self::removeEmpty($directory, $dryRun);
            }
            self::removeEmpty($root . '/' . $variant, $dryRun);
            $fontDirectory = $root . '/fonts/' . $variant;
            self::removeMatching($fontDirectory, static fn (string $file): bool => $variableFonts && isset($variants[$variant], $formats[pathinfo($file, PATHINFO_EXTENSION)]), $result, 'variable');
            self::removeEmpty($fontDirectory, $dryRun);
        }
        self::removeEmpty($root . '/fonts', $dryRun);
        return $result;
    }

    private static function array(string $path): array
    {
        $value = json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($value) || !array_is_list($value)) throw new RuntimeException("Expected a JSON array at {$path}");
        return $value;
    }

    private static function selection(array $config, string $key, array $allowed): array
    {
        if (!array_key_exists($key, $config)) return $allowed;
        $selected = $config[$key];
        if (!is_array($selected) || !array_is_list($selected) || $selected === [] || array_diff($selected, $allowed)) throw new InvalidArgumentException("Material Symbols {$key} must be a non-empty array of known values.");
        return array_values(array_unique($selected));
    }

    private static function boolean(array $config, string $key, bool $default): bool
    {
        if (!array_key_exists($key, $config)) return $default;
        if (!is_bool($config[$key])) throw new InvalidArgumentException("Material Symbols {$key} must be a boolean.");
        return $config[$key];
    }

    /** @param array{files:int,bytes:int,dryRun:bool} $result */
    private static function removeMatching(string $directory, callable $keep, array &$result, string $kind): void
    {
        if (!is_dir($directory) || is_link($directory)) return;
        foreach (new \DirectoryIterator($directory) as $file) {
            $matches = $kind === 'svg' ? $file->getExtension() === 'svg' : str_starts_with($file->getFilename(), 'material-symbols-variable.');
            if (!$file->isFile() || $file->isLink() || !$matches || $keep($file->getFilename())) continue;
            $size = $file->getSize();
            if (!$result['dryRun'] && !unlink($file->getPathname())) throw new RuntimeException("Cannot remove file: {$file->getPathname()}");
            ++$result['files'];
            $result['bytes'] += $size;
        }
    }

    private static function removeEmpty(string $path, bool $dryRun): void
    {
        if (!$dryRun && is_dir($path) && !is_link($path) && !(new \FilesystemIterator($path))->valid()) rmdir($path);
    }
}
